import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import {
  checkShiftConflicts,
  executeCustomRules,
  createSystemNotification,
} from "@/lib/automations";
import { createAuditLogTx } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { updateShiftSchema, validateBody } from "@/lib/validations";

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

    // Only OWNER, ADMIN, MANAGER can update shifts
    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const parsed = validateBody(updateShiftSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // Normalise employeeId: treat "" as null (unassign)
    const hasEmployeeIdField = "employeeId" in body;
    const newEmployeeId =
      hasEmployeeIdField && !body.employeeId ? null : body.employeeId;

    // Fetch current shift for conflict check and status logic
    const currentShift = await prisma.shift.findFirst({
      where: { id, workspaceId },
    });
    if (!currentShift) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Run conflict detection only when the shift will have an employee
    const resolvedEmployeeId = hasEmployeeIdField
      ? newEmployeeId
      : currentShift.employeeId;

    if (
      resolvedEmployeeId &&
      (body.date || body.startTime || body.endTime || hasEmployeeIdField)
    ) {
      const conflicts = await checkShiftConflicts({
        employeeId: resolvedEmployeeId,
        date: body.date || currentShift.date.toISOString().split("T")[0],
        startTime: body.startTime || currentShift.startTime,
        endTime: body.endTime || currentShift.endTime,
        workspaceId,
        excludeShiftId: id,
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "Conflicts detected", conflicts },
          { status: 409 },
        );
      }
    }

    // Auto-derive status when assignment changes:
    // - Unassigning → OPEN
    // - Assigning an OPEN shift → SCHEDULED
    let derivedStatus = body.status as string | undefined;
    if (hasEmployeeIdField) {
      if (!newEmployeeId) {
        derivedStatus = "OPEN";
      } else if (currentShift.status === "OPEN" && !body.status) {
        derivedStatus = "SCHEDULED";
      }
    }

    const shift = await prisma.$transaction(async (tx) => {
      const updated = await tx.shift.updateMany({
        where: { id, workspaceId },
        data: {
          date: body.date ? new Date(body.date) : undefined,
          startTime: body.startTime,
          endTime: body.endTime,
          ...(hasEmployeeIdField ? { employeeId: newEmployeeId } : {}),
          locationId: body.locationId || null,
          notes: body.notes,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: derivedStatus as any,
        },
      });

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "UPDATE",
        entityType: "shift",
        entityId: id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId: workspaceId!,
        changes: body,
      });

      return updated;
    });

    // ── Notify employee on shift update / reassignment ──
    const finalEmployeeId = hasEmployeeIdField
      ? newEmployeeId
      : currentShift.employeeId;

    if (finalEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: finalEmployeeId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (emp?.email) {
        const shiftDate = body.date ? new Date(body.date) : currentShift.date;
        const shiftDateStr = shiftDate.toLocaleDateString("de-DE", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const st = body.startTime || currentShift.startTime;
        const et = body.endTime || currentShift.endTime;
        const wasReassigned =
          hasEmployeeIdField &&
          newEmployeeId &&
          currentShift.employeeId !== newEmployeeId;

        const notifType = wasReassigned ? "SHIFT_REASSIGNED" : "SHIFT_UPDATED";
        const notifTitle = wasReassigned
          ? "Schicht zugewiesen"
          : "Schicht aktualisiert";
        const notifMessage = wasReassigned
          ? `Ihnen wurde eine Schicht am ${shiftDateStr} (${st}–${et}) zugewiesen.`
          : `Ihre Schicht am ${shiftDateStr} wurde aktualisiert: ${st}–${et}.`;

        createSystemNotification({
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          link: "/schichtplan",
          workspaceId: workspaceId!,
          recipientType: "employee",
          employeeEmail: emp.email,
        }).catch((err) =>
          log.error("[shifts/PATCH] Notification error:", { error: err }),
        );
      }
    }

    // ── Automation: Execute custom rules ──
    executeCustomRules("shift.updated", workspaceId!, {
      id,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      employeeId: body.employeeId,
      status: body.status,
    });

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId!, "shift.updated", { id, ...body }).catch(
      (err) =>
        log.error("[webhook] shift.updated dispatch error", { error: err }),
    );

    return NextResponse.json(shift);
  } catch (error) {
    log.error("Error updating shift:", { error: error });
    captureRouteError(error, { route: "/api/shifts/[id]", method: "PATCH" });
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

    // Only OWNER, ADMIN, MANAGER can delete shifts
    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    await prisma.$transaction(async (tx) => {
      await tx.shift.deleteMany({
        where: { id, workspaceId },
      });

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "DELETE",
        entityType: "shift",
        entityId: id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId: workspaceId!,
      });
    });

    // ── Automation: Execute custom rules ──
    executeCustomRules("shift.deleted", workspaceId!, { id });

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId!, "shift.deleted", { id }).catch((err) =>
      log.error("[webhook] shift.deleted dispatch error", { error: err }),
    );

    return NextResponse.json({ message: "Shift deleted" });
  } catch (error) {
    log.error("Error deleting shift:", { error: error });
    captureRouteError(error, { route: "/api/shifts/[id]", method: "DELETE" });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
