import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  requirePermission,
  requireAdmin,
  isEmployee,
} from "@/lib/authorization";
import { createAuditLogTx } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { updateEmployeeSchema, validateBody } from "@/lib/validations";
import { reconcileSeatsFromEmployees } from "@/lib/billing-seats";
import { cache } from "@/lib/cache";

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
    const currentUser = session.user as SessionUser;
    const workspaceId = currentUser.workspaceId;

    // EMPLOYEE role may only fetch their own record
    if (isEmployee(currentUser) && currentUser.employeeId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // DSGVO Art. 5 data-minimisation: employees must not see their own wage
    // or contract details (§ BetrVG / German labour law — Stundenlohn is
    // between employer and employee individually, not self-disclosed via API).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hourlyRate, contractType, ...employeeForEmployee } = employee;
    const responseEmployee = isEmployee(currentUser)
      ? employeeForEmployee
      : employee;

    return NextResponse.json({
      ...responseEmployee,
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

    // MiLoG hard block — must run before the transaction so the DB is
    // never updated with an illegal wage.
    if (body.hourlyRate != null && body.hourlyRate < MILOG_MIN_WAGE) {
      return NextResponse.json(
        {
          error: "MILOG_VIOLATION",
          message: `Der angegebene Stundenlohn (${body.hourlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h) unterschreitet den gesetzlichen Mindestlohn von ${MILOG_MIN_WAGE.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h (MiLoG). Bitte korrigieren Sie den Stundenlohn.`,
          messageEn: `The specified hourly rate (${body.hourlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h) is below the statutory minimum wage of ${MILOG_MIN_WAGE.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h (MiLoG). Please correct the hourly rate.`,
          milogMinWage: MILOG_MIN_WAGE,
        },
        { status: 422 },
      );
    }

    // Changing roles requires OWNER or ADMIN
    if (body.role) {
      const adminForbidden = requireAdmin(user);
      if (adminForbidden) return adminForbidden;
    }

    const { changedUserId } = await prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
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
      let changedUserId: string | null = null;
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
          changedUserId = emp.userId;
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

      return { changedUserId };
    });

    // H-2: Bust the JWT cache for the affected user immediately after role change
    // so the new role takes effect on their next request, not after TTL expiry.
    if (changedUserId) {
      await cache.del(`jwt:${changedUserId}`);
    }

    // M-1: Fetch the actual updated record to return (updateMany returns {count})
    const updatedEmployee = await prisma.employee.findFirst({
      where: { id, workspaceId },
    });

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId!, "employee.updated", { id, ...body }).catch(
      (err) =>
        log.error("[webhook] employee.updated dispatch error", { error: err }),
    );

    // ── Pay-as-you-grow: re-sync seats when activation toggles ──
    // Only billing-relevant edits (activate/deactivate) need to hit Stripe.
    if (body.isActive !== undefined) {
      const seatResult = await reconcileSeatsFromEmployees(
        workspaceId!,
        body.isActive ? "add" : "remove",
      );
      if (!seatResult.ok) {
        log.error("[billing-seats] PATCH seat sync failed", {
          workspaceId,
          reason: seatResult.reason,
        });
      }
    }

    return NextResponse.json({ ...updatedEmployee });
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
    const deleteSeatResult = await reconcileSeatsFromEmployees(
      workspaceId!,
      "remove",
    );
    if (!deleteSeatResult.ok) {
      log.error("[billing-seats] DELETE seat sync failed", {
        workspaceId,
        reason: deleteSeatResult.reason,
      });
    }

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
