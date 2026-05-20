import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, requireAdmin } from "@/lib/authorization";
import { createAuditLogTx } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { updateEmployeeSchema, validateBody } from "@/lib/validations";
import { reconcileSeatsFromEmployees } from "@/lib/billing-seats";

/** MiLoG minimum wage (€/h) — updated annually */
const MILOG_MIN_WAGE = 12.82;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as SessionUser).workspaceId;

    const [employee, sosStats] = await Promise.all([
      prisma.employee.findFirst({
        where: { id, workspaceId },
        include: {
          shifts: { orderBy: { date: "desc" }, take: 20 },
          timeEntries: { orderBy: { date: "desc" }, take: 20 },
          absenceRequests: { orderBy: { startDate: "desc" }, take: 20 },
          vacationBalances: { orderBy: { year: "desc" }, take: 3 },
          department: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      }),
      prisma.sosNotification.groupBy({
        by: ["response"],
        where: {
          employeeId: id,
          sosRequest: { status: { in: ["FILLED", "EXPIRED", "CANCELLED"] } },
        },
        _count: true,
      }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const sosTotal = sosStats.reduce(
      (s: number, g: { _count: number }) => s + g._count,
      0,
    );
    const sosPickups =
      sosStats.find((g: { response: string }) => g.response === "ACCEPTED")
        ?._count ?? 0;
    const sosReliability =
      sosTotal === 0 ? null : Math.round((sosPickups / sosTotal) * 100);

    return NextResponse.json({
      ...employee,
      sosStats: {
        total: sosTotal,
        pickups: sosPickups,
        reliability: sosReliability,
      },
    });
  } catch (error) {
    log.error("Error fetching employee:", { error: error });
    captureRouteError(error, { route: "/api/employees/[id]", method: "GET" });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can update employees
    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const parsed = validateBody(updateEmployeeSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // Changing roles requires OWNER or ADMIN
    if (body.role) {
      const adminForbidden = requireAdmin(user);
      if (adminForbidden) return adminForbidden;
    }

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.updateMany({
        where: { id, workspaceId },
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email || undefined,
          phone: body.phone || null,
          position: body.position || null,
          hourlyRate: body.hourlyRate ?? null,
          weeklyHours: body.weeklyHours ?? null,
          workDaysPerWeek: body.workDaysPerWeek ?? undefined,
          contractType: body.contractType || undefined,
          flexibleWork: body.flexibleWork,
          color: body.color,
          isActive: body.isActive,
          locationId:
            body.locationId !== undefined ? body.locationId || null : undefined,
          departmentId:
            body.departmentId !== undefined
              ? body.departmentId || null
              : undefined,
        },
      });

      // ── Update linked user's role (OWNER/ADMIN only) ──
      if (body.role) {
        const emp = await tx.employee.findFirst({
          where: { id, workspaceId },
          select: { userId: true },
        });
        if (emp?.userId) {
          // Prevent changing own role or demoting the last OWNER
          if (emp.userId === user.id) {
            throw new Error("SELF_ROLE_CHANGE");
          }
          if (body.role !== "OWNER") {
            const ownerCount = await tx.user.count({
              where: { workspaceId, role: "OWNER" },
            });
            const targetUser = await tx.user.findUnique({
              where: { id: emp.userId },
              select: { role: true },
            });
            if (targetUser?.role === "OWNER" && ownerCount <= 1) {
              throw new Error("LAST_OWNER");
            }
          }
          await tx.user.update({
            where: { id: emp.userId },
            data: { role: body.role },
          });
        }
      }

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "UPDATE",
        entityType: "employee",
        entityId: id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId: workspaceId!,
        changes: body,
      });

      return updated;
    });

    const warnings: string[] = [];
    const parsedRate = body.hourlyRate ?? null;
    if (parsedRate != null && parsedRate < MILOG_MIN_WAGE) {
      warnings.push(
        `Stundenlohn (${parsedRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €) liegt unter dem gesetzlichen Mindestlohn (${MILOG_MIN_WAGE.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h, MiLoG)`,
      );
    }

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId!, "employee.updated", { id, ...body }).catch(
      (err) =>
        log.error("[webhook] employee.updated dispatch error", { error: err }),
    );

    // ── Pay-as-you-grow: re-sync seats when activation toggles ──
    // Only billing-relevant edits (activate/deactivate) need to hit Stripe.
    if (body.isActive !== undefined) {
      await reconcileSeatsFromEmployees(
        workspaceId!,
        body.isActive ? "add" : "remove",
      );
    }

    return NextResponse.json({
      ...employee,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SELF_ROLE_CHANGE") {
        return NextResponse.json(
          { error: "Sie können Ihre eigene Rolle nicht ändern." },
          { status: 409 },
        );
      }
      if (error.message === "LAST_OWNER") {
        return NextResponse.json(
          { error: "Der letzte Eigentümer kann nicht herabgestuft werden." },
          { status: 409 },
        );
      }
    }
    log.error("Error updating employee:", { error: error });
    captureRouteError(error, { route: "/api/employees/[id]", method: "PATCH" });
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can delete employees
    const forbidden = requirePermission(user, "employees", "delete");
    if (forbidden) return forbidden;

    await prisma.$transaction(async (tx) => {
      await tx.employee.deleteMany({
        where: { id, workspaceId },
      });

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "DELETE",
        entityType: "employee",
        entityId: id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId: workspaceId!,
      });
    });

    // ── Pay-as-you-grow: drop Stripe seat quantity ──
    // Credit is applied to the customer's NEXT invoice (create_prorations)
    // rather than issuing an immediate credit invoice. Fails silently for
    // sim-mode / unbilled workspaces. Helper clamps to a minimum of 1 seat
    // so the subscription never collapses to zero.
    await reconcileSeatsFromEmployees(workspaceId!, "remove");

    return NextResponse.json({ message: "Employee deleted" });
  } catch (error) {
    log.error("Error deleting employee:", { error: error });
    captureRouteError(error, {
      route: "/api/employees/[id]",
      method: "DELETE",
    });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
