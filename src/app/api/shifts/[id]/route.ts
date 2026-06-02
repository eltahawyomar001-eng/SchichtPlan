import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
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
import { withRoute } from "@/lib/with-route";
import { requireSchichtplanungAddon } from "@/lib/schichtplanung-addon";
import {
  checkArbZg5RestPeriod,
  checkArbZg4BreakRequirement,
  shiftGrossMinutes,
  suggestBreakForGross,
  requiredBreakForNet,
} from "@/lib/arbzg";
import {
  isPublicHoliday,
  isSunday,
  isNightShift,
  calculateSurcharge,
} from "@/lib/holidays";
import { requireLocationCertifications } from "@/lib/certification-check";

export const PATCH = withRoute(
  "/api/shifts/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can update shifts
    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    // Schichtplanung add-on gate (Enterprise always allowed)
    if (workspaceId) {
      const addonRequired = await requireSchichtplanungAddon(workspaceId);
      if (addonRequired) return addonRequired;
    }

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(updateShiftSchema, _json.data);
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
        date:
          body.date ||
          new Date(currentShift.date).toLocaleDateString("en-CA", {
            timeZone: "Europe/Berlin",
          }),
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

      // ArbZG §5 — 11h minimum rest between shifts (hard block)
      const restDate =
        body.date ||
        new Date(currentShift.date).toLocaleDateString("en-CA", {
          timeZone: "Europe/Berlin",
        });
      const rest = await checkArbZg5RestPeriod({
        employeeId: resolvedEmployeeId,
        date: restDate,
        startTime: body.startTime || currentShift.startTime,
        endTime: body.endTime || currentShift.endTime,
        workspaceId: workspaceId!,
        excludeShiftId: id,
      });
      if (rest.violation) {
        return NextResponse.json(
          {
            error: "ARBZG_5_VIOLATION",
            message: rest.message,
            messageEn: rest.messageEn,
          },
          { status: 422 },
        );
      }

      // §34a / certification hard block
      const resolvedLocationId =
        "locationId" in body ? body.locationId : currentShift.locationId;
      const certErr = await requireLocationCertifications(
        resolvedEmployeeId,
        resolvedLocationId,
      );
      if (certErr) return certErr;
    }

    // ── ArbZG §4 — mandatory break enforcement (hard block) ──
    // Applies whether or not the shift is assigned. When the client doesn't
    // touch the break but the (possibly new) duration needs more, auto-bump it
    // so a non-compliant shift can never persist.
    const effStart = body.startTime ?? currentShift.startTime;
    const effEnd = body.endTime ?? currentShift.endTime;
    const grossM = shiftGrossMinutes(effStart, effEnd);
    const breakProvided = body.breakMinutes != null;
    let effBreak = breakProvided
      ? body.breakMinutes!
      : currentShift.breakMinutes;
    if (!breakProvided && effBreak < requiredBreakForNet(grossM - effBreak)) {
      effBreak = suggestBreakForGross(grossM);
    }
    const break4 = checkArbZg4BreakRequirement(effStart, effEnd, effBreak);
    if (break4.violation) {
      return NextResponse.json(
        {
          error: "ARBZG_4_VIOLATION",
          message: break4.message,
          messageEn: break4.messageEn,
          minBreakMinutes: break4.minBreakMinutes,
        },
        { status: 422 },
      );
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

    // Recalculate surcharges when date or times change — a shift moved to a
    // Sunday/holiday must pick up the correct surcharge, not keep the old one.
    let surchargeFields: Record<string, unknown> = {};
    if (body.date || body.startTime || body.endTime) {
      const effectiveDate = body.date
        ? new Date(body.date)
        : new Date(currentShift.date);
      const effectiveStart = body.startTime ?? currentShift.startTime;
      const effectiveEnd = body.endTime ?? currentShift.endTime;

      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId! },
        select: { bundesland: true },
      });
      const bundesland = ws?.bundesland ?? "HE";

      const holCheck = isPublicHoliday(effectiveDate, bundesland);
      const sunCheck = isSunday(effectiveDate);
      const nightCheck = isNightShift(effectiveStart, effectiveEnd);
      const surch = calculateSurcharge({
        isNight: nightCheck,
        isSunday: sunCheck,
        isHoliday: holCheck.isHoliday,
      });

      surchargeFields = {
        isNightShift: nightCheck,
        isHolidayShift: holCheck.isHoliday,
        isSundayShift: sunCheck,
        surchargePercent: surch,
      };
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
          breakMinutes: effBreak,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: derivedStatus as any,
          ...surchargeFields,
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

    // ArbZG §4 — non-blocking break advisory when time changes
    const effectiveStart = body.startTime ?? currentShift.startTime;
    const effectiveEnd = body.endTime ?? currentShift.endTime;
    const breakAdvisory = checkArbZg4BreakRequirement(
      effectiveStart,
      effectiveEnd,
    );
    const warnings = breakAdvisory.required
      ? [
          {
            code: "ARBZG_4_BREAK",
            message: breakAdvisory.message,
            messageEn: breakAdvisory.messageEn,
            minBreakMinutes: breakAdvisory.minBreakMinutes,
          },
        ]
      : [];

    return NextResponse.json({ ...shift, warnings });
  },
);

export const DELETE = withRoute(
  "/api/shifts/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can delete shifts
    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    // Schichtplanung add-on gate (Enterprise always allowed)
    if (workspaceId) {
      const addonRequired = await requireSchichtplanungAddon(workspaceId);
      if (addonRequired) return addonRequired;
    }

    await prisma.$transaction(async (tx) => {
      await tx.shift.updateMany({
        where: { id, workspaceId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

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
  },
);
