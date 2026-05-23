import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import {
  cascadeAbsenceApproval,
  createSystemNotification,
  executeCustomRules,
} from "@/lib/automations";
import { createESignature, getClientIp } from "@/lib/e-signature";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import {
  updateAbsenceStatusSchema,
  editAbsenceSchema,
  validateBody,
} from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Sync VacationBalance used/planned/remaining from actual absence data.
 * Recalculates from scratch to avoid drift.
 */
async function syncVacationBalance(
  employeeId: string,
  year: number,
  workspaceId: string,
): Promise<void> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const absences = await prisma.absenceRequest.findMany({
    where: {
      employeeId,
      workspaceId,
      category: "URLAUB",
      status: { in: ["GENEHMIGT", "AUSSTEHEND"] },
      startDate: { lte: endOfYear },
      endDate: { gte: startOfYear },
      deletedAt: null,
    },
    select: { status: true, totalDays: true },
  });

  let used = 0;
  let planned = 0;
  for (const a of absences) {
    if (a.status === "GENEHMIGT") used += a.totalDays;
    else if (a.status === "AUSSTEHEND") planned += a.totalDays;
  }
  used = Math.round(used * 10) / 10;
  planned = Math.round(planned * 10) / 10;

  const balance = await prisma.vacationBalance.findUnique({
    where: { employeeId_year: { employeeId, year } },
  });

  if (balance) {
    const remaining =
      Math.round(
        (balance.totalEntitlement + balance.carryOver - used - planned) * 10,
      ) / 10;
    await prisma.vacationBalance.update({
      where: { id: balance.id },
      data: { used, planned, remaining },
    });
  }
  // If no balance record exists, the GET endpoint will auto-create it
}

// ─── PATCH  /api/absences/[id] ──────────────────────────────────
// Used for approve / reject / cancel
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const rawBody = await req.json();

    const existing = await prisma.absenceRequest.findFirst({
      where: { id, workspaceId: user.workspaceId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Branch: field edits (no `status` key) — employee editing own pending ──
    if (!("status" in rawBody)) {
      const editParsed = validateBody(editAbsenceSchema, rawBody);
      if (!editParsed.success) return editParsed.response;
      const edits = editParsed.data;

      // Only the request owner (or management) can edit, and only while pending.
      if (existing.status !== "AUSSTEHEND") {
        return NextResponse.json(
          { error: "ONLY_PENDING_CAN_BE_EDITED" },
          { status: 409 },
        );
      }
      if (isEmployee(user) && existing.employeeId !== user.employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const newStart = edits.startDate
        ? new Date(edits.startDate)
        : existing.startDate;
      const newEnd = edits.endDate ? new Date(edits.endDate) : existing.endDate;
      if (newEnd < newStart) {
        return NextResponse.json(
          { error: "END_BEFORE_START" },
          { status: 400 },
        );
      }

      // Recompute totalDays (count weekdays, subtract halves)
      let totalDays = 0;
      const cursor = new Date(newStart);
      while (cursor <= newEnd) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) totalDays++;
        cursor.setDate(cursor.getDate() + 1);
      }
      const halfDayStart = edits.halfDayStart ?? existing.halfDayStart;
      const halfDayEnd = edits.halfDayEnd ?? existing.halfDayEnd;
      if (halfDayStart) totalDays -= 0.5;
      if (halfDayEnd) totalDays -= 0.5;

      const updated = await prisma.absenceRequest.update({
        where: { id },
        data: {
          ...(edits.category && { category: edits.category }),
          startDate: newStart,
          endDate: newEnd,
          halfDayStart,
          halfDayEnd,
          totalDays,
        },
        include: { employee: true },
      });

      // Sync vacation balance for URLAUB
      if (
        existing.category === "URLAUB" ||
        (edits.category && edits.category === "URLAUB")
      ) {
        syncVacationBalance(
          existing.employeeId,
          newStart.getFullYear(),
          user.workspaceId!,
        ).catch((err) =>
          log.error("VacationBalance sync failed", { error: err }),
        );
      }

      return NextResponse.json(updated);
    }

    const parsed = validateBody(updateAbsenceStatusSchema, rawBody);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const data: Record<string, unknown> = {};

    if (body.status) {
      // Approve/reject requires management role
      if (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") {
        const forbidden = requirePermission(user, "absences", "approve");
        if (forbidden) return forbidden;

        // Managers must not approve their own absence requests
        if (existing.employeeId === user.employeeId) {
          return NextResponse.json(
            {
              error:
                "Sie können Ihren eigenen Abwesenheitsantrag nicht genehmigen.",
            },
            { status: 403 },
          );
        }
      }

      // ── Idempotency: reject duplicate status transitions ──
      // If the absence is already in the requested status, return it as-is
      // to prevent duplicate signatures, notifications, and emails.
      if (existing.status === body.status) {
        const current = await prisma.absenceRequest.findUnique({
          where: { id },
          include: { employee: true },
        });
        return NextResponse.json(current);
      }

      // ── Guard: only AUSSTEHEND can be approved/rejected ──
      if (
        (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") &&
        existing.status !== "AUSSTEHEND"
      ) {
        return NextResponse.json(
          {
            error:
              "Nur ausstehende Anträge können genehmigt oder abgelehnt werden.",
          },
          { status: 409 },
        );
      }

      // Cancel (STORNIERT) — employee can cancel own, management can cancel any.
      // Only AUSSTEHEND requests can be canceled: once approved/rejected the
      // record is locked (audit trail / vacation balance integrity).
      if (body.status === "STORNIERT") {
        if (existing.status !== "AUSSTEHEND") {
          return NextResponse.json(
            { error: "ONLY_PENDING_CAN_BE_CANCELLED" },
            { status: 409 },
          );
        }
        if (isEmployee(user) && existing.employeeId !== user.employeeId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      data.status = body.status;
      if (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") {
        data.reviewedBy = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = body.reviewNote || null;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.absenceRequest.update({
        where: { id, workspaceId: user.workspaceId! },
        data,
        include: { employee: true },
      });

      return result;
    });

    // ── Sync VacationBalance for URLAUB absences on any status change ──
    if (existing.category === "URLAUB" && body.status) {
      const absenceYear = existing.startDate.getFullYear();
      syncVacationBalance(
        existing.employeeId,
        absenceYear,
        user.workspaceId!,
      ).catch((err) =>
        log.error("VacationBalance sync failed", { error: err }),
      );
    }

    // ── E-Signature: Record signed approval/rejection ──
    if (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") {
      createESignature({
        action:
          body.status === "GENEHMIGT" ? "absence.approve" : "absence.reject",
        entityType: "AbsenceRequest",
        entityId: id,
        signer: {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
        },
        workspaceId: user.workspaceId!,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch((err) => log.error("E-signature failed", { error: err }));
    }

    // ── Automation: Cascade on approval ──
    if (body.status === "GENEHMIGT") {
      const cascadeResult = await cascadeAbsenceApproval({
        absenceId: id,
        employeeId: existing.employeeId,
        startDate: existing.startDate,
        endDate: existing.endDate,
        workspaceId: user.workspaceId!,
        reviewerId: user.id,
      });

      // Notify employee
      if (updated.employee.email) {
        await createSystemNotification({
          type: "ABSENCE_APPROVED",
          title: "Abwesenheit genehmigt",
          message: `Ihr Abwesenheitsantrag wurde genehmigt.${cascadeResult.cancelledShifts > 0 ? ` ${cascadeResult.cancelledShifts} betroffene Schicht(en) wurden abgesagt.` : ""}`,
          link: "/abwesenheiten",
          workspaceId: user.workspaceId!,
          recipientType: "employee",
          employeeEmail: updated.employee.email,
        });
      }
    }

    // ── Automation: Notify on rejection ──
    if (body.status === "ABGELEHNT" && updated.employee.email) {
      await createSystemNotification({
        type: "ABSENCE_REJECTED",
        title: "Abwesenheit abgelehnt",
        message: `Ihr Abwesenheitsantrag wurde abgelehnt.${body.reviewNote ? ` Grund: ${body.reviewNote}` : ""}`,
        link: "/abwesenheiten",
        workspaceId: user.workspaceId!,
        recipientType: "employee",
        employeeEmail: updated.employee.email,
      });
    }

    // ── Automation: Execute custom rules ──
    if (body.status === "GENEHMIGT") {
      executeCustomRules("absence.approved", user.workspaceId!, {
        id,
        employeeId: existing.employeeId,
        employeeEmail: updated.employee.email || "",
        category: existing.category,
        startDate: existing.startDate.toISOString(),
        endDate: existing.endDate.toISOString(),
        totalDays: existing.totalDays,
      });

      // ── Webhook dispatch (fire & forget) ──
      dispatchWebhook(user.workspaceId!, "absence.approved", {
        id,
        employeeId: existing.employeeId,
        category: existing.category,
        startDate: existing.startDate.toISOString(),
        endDate: existing.endDate.toISOString(),
        totalDays: existing.totalDays,
      }).catch((err) =>
        log.error("[webhook] absence.approved dispatch error", { error: err }),
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error updating absence:", { error: error });
    captureRouteError(error, { route: "/api/absences/[id]", method: "PATCH" });
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

// ─── DELETE  /api/absences/[id] ─────────────────────────────────
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    const existing = await prisma.absenceRequest.findFirst({
      where: { id, workspaceId: user.workspaceId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only delete their own absence requests
    if (isEmployee(user)) {
      const linkedEmployee = await prisma.employee.findFirst({
        where: { workspaceId: user.workspaceId, email: user.email },
      });
      if (!linkedEmployee || existing.employeeId !== linkedEmployee.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await prisma.absenceRequest.delete({ where: { id } });

    // ── Sync VacationBalance after deletion ──
    if (existing.category === "URLAUB") {
      syncVacationBalance(
        existing.employeeId,
        existing.startDate.getFullYear(),
        user.workspaceId!,
      ).catch((err) =>
        log.error("VacationBalance sync failed", { error: err }),
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting absence:", { error: error });
    captureRouteError(error, { route: "/api/absences/[id]", method: "DELETE" });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
