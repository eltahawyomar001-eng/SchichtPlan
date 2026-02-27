/**
 * Auto-Fill & Recovery Engine
 *
 * Automatically finds and assigns replacement employees when shifts are vacated
 * (absence approval, swap, sick leave). Integrates with the existing CSP-based
 * auto-scheduler backfill engine for candidate scoring.
 *
 * Flow:
 *  1. Shift is vacated (absence approved, employee calls sick, swap executed)
 *  2. Engine searches for eligible replacements via `runBackfill`
 *  3. Best candidate is auto-assigned to the shift
 *  4. Employee receives "why" notification: "You have been assigned because [reason]"
 *  5. If no candidate found → ManagerAlert (URGENT) + AuditLog
 *
 * Compliance:
 *  - ArbZG §3: Max 10h/day
 *  - ArbZG §5: Min 11h rest between shifts
 *  - ArbZG §3: Max 48h/week
 *  - § 12 TzBfG: Emergency flag when shift is < 4 days away
 */

import { prisma } from "@/lib/db";
import { runBackfill } from "@/lib/auto-scheduler";
import { createSystemNotification } from "@/lib/automations";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface AutoFillRequest {
  /** The shift that needs a replacement */
  shiftId: string;
  /** Employee who vacated the shift */
  vacatedByEmployeeId?: string;
  /** Human-readable reason for the vacancy */
  reason: string;
  workspaceId: string;
  /** Bundesland for holiday/surcharge calculations */
  bundesland?: string;
}

export interface AutoFillResult {
  success: boolean;
  /** The AutoFillLog record id */
  logId: string;
  /** Assigned employee id (if successful) */
  assignedToEmployeeId?: string;
  assignedToEmployeeName?: string;
  /** Whether this was an emergency (< 4 days notice) */
  isEmergency: boolean;
  /** Number of candidates evaluated */
  candidatesEvaluated: number;
  /** Failure reason (if no candidate found) */
  failureReason?: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** § 12 TzBfG — notice period for shift assignment changes */
const EMERGENCY_NOTICE_DAYS = 4;

// ═══════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Find and assign a replacement employee for a vacated shift.
 *
 * Uses the existing CSP backfill engine to find ranked candidates,
 * then auto-assigns the top candidate and sends notifications.
 *
 * Fire-and-forget safe — errors are caught and logged.
 */
export async function findAndAssignReplacement(
  request: AutoFillRequest,
): Promise<AutoFillResult> {
  const { shiftId, vacatedByEmployeeId, reason, workspaceId } = request;

  log.info("[auto-fill] Starting replacement search", {
    shiftId,
    vacatedByEmployeeId,
    reason,
  });

  // 1. Load the shift to get date info for emergency detection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shift = await (prisma as any).shift.findFirst({
    where: { id: shiftId, workspaceId },
    include: {
      employee: true,
      location: true,
    },
  });

  if (!shift) {
    log.warn("[auto-fill] Shift not found, skipping", { shiftId });
    return {
      success: false,
      logId: "",
      isEmergency: false,
      candidatesEvaluated: 0,
      failureReason: "Shift not found",
    };
  }

  // 2. Detect emergency (shift is < 4 days away)
  const shiftDate = new Date(shift.date);
  const now = new Date();
  const daysUntilShift = Math.floor(
    (shiftDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isEmergency = daysUntilShift < EMERGENCY_NOTICE_DAYS;

  // 3. Get workspace bundesland
  const bundesland =
    request.bundesland ||
    (
      await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { bundesland: true },
      })
    )?.bundesland ||
    "HE";

  // 4. Unassign the current employee (set shift to OPEN)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).shift.update({
    where: { id: shiftId },
    data: { employeeId: null, status: "OPEN" },
  });

  // 5. Create initial AutoFillLog (PENDING)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fillLog = await (prisma as any).autoFillLog.create({
    data: {
      shiftId,
      vacatedByEmployeeId: vacatedByEmployeeId || null,
      reason,
      isEmergency,
      status: "PENDING",
      workspaceId,
    },
  });

  try {
    // 6. Run backfill search using existing CSP engine
    const backfillResult = await runBackfill({
      workspaceId,
      shiftId,
      bundesland,
      maxCandidates: 10,
    });

    const candidatesEvaluated = backfillResult.totalCandidates;

    if (backfillResult.candidates.length === 0) {
      // ── No One Available Protocol ──
      return await handleNoOneAvailable({
        fillLogId: fillLog.id,
        shiftId,
        shift,
        reason,
        isEmergency,
        candidatesEvaluated,
        workspaceId,
      });
    }

    // 7. Auto-assign the top candidate
    const bestCandidate = backfillResult.candidates[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shift.update({
      where: { id: shiftId },
      data: {
        employeeId: bestCandidate.employeeId,
        status: "SCHEDULED",
      },
    });

    // 8. Update AutoFillLog → ASSIGNED
    const complianceChecks = bestCandidate.reasons.map((r) => ({
      check: r,
      passed: true,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).autoFillLog.update({
      where: { id: fillLog.id },
      data: {
        status: "ASSIGNED",
        assignedToEmployeeId: bestCandidate.employeeId,
        candidatesEvaluated,
        complianceChecks: JSON.stringify(complianceChecks),
      },
    });

    // 9. Load vacated employee name for the "why" message
    let vacatedByName = "ein Kollege";
    if (vacatedByEmployeeId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vacatedEmp = await (prisma as any).employee.findUnique({
        where: { id: vacatedByEmployeeId },
        select: { firstName: true, lastName: true },
      });
      if (vacatedEmp) {
        vacatedByName = `${vacatedEmp.firstName} ${vacatedEmp.lastName}`;
      }
    }

    // 10. Get assigned employee's email for notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignedEmp = await (prisma as any).employee.findUnique({
      where: { id: bestCandidate.employeeId },
      select: { email: true, firstName: true, lastName: true },
    });

    const shiftDateStr = shiftDate.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const locationStr = shift.location?.name
      ? ` am Standort ${shift.location.name}`
      : "";

    // 11. Send "why" notification to the assigned employee
    if (assignedEmp?.email) {
      const emergencyHint = isEmergency
        ? " ⚠️ Kurzfristige Vertretung (< 4 Tage Vorlauf)."
        : "";

      await createSystemNotification({
        type: "AUTO_FILL_ASSIGNED",
        title: "Schicht automatisch zugewiesen",
        message:
          `Ihnen wurde die Schicht am ${shiftDateStr} (${shift.startTime}–${shift.endTime})${locationStr} zugewiesen, ` +
          `da ${vacatedByName} aufgrund genehmigter Abwesenheit nicht verfügbar ist.${emergencyHint}`,
        link: "/schichtplan",
        workspaceId,
        recipientType: "employee",
        employeeEmail: assignedEmp.email,
      });
    }

    // 12. Notify managers about successful auto-fill
    await createSystemNotification({
      type: "AUTO_FILL_SUCCESS",
      title: "Automatische Vertretung gefunden",
      message:
        `${bestCandidate.employeeName} wurde automatisch als Vertretung für die Schicht am ` +
        `${shiftDateStr} (${shift.startTime}–${shift.endTime})${locationStr} eingeteilt. ` +
        `Grund: ${reason}`,
      link: "/schichtplan",
      workspaceId,
      recipientType: "managers",
    });

    // 13. Audit log
    createAuditLog({
      action: "CREATE",
      entityType: "auto-fill",
      entityId: fillLog.id,
      workspaceId,
      changes: {
        shiftId,
        assignedTo: bestCandidate.employeeId,
        assignedName: bestCandidate.employeeName,
        vacatedBy: vacatedByEmployeeId,
        reason,
        isEmergency,
        score: bestCandidate.score,
      },
    });

    log.info("[auto-fill] Replacement assigned successfully", {
      shiftId,
      assignedTo: bestCandidate.employeeId,
      assignedName: bestCandidate.employeeName,
      score: bestCandidate.score,
      isEmergency,
    });

    return {
      success: true,
      logId: fillLog.id,
      assignedToEmployeeId: bestCandidate.employeeId,
      assignedToEmployeeName: bestCandidate.employeeName,
      isEmergency,
      candidatesEvaluated,
    };
  } catch (error) {
    log.error("[auto-fill] Error during replacement search", {
      shiftId,
      error,
    });

    // Update log to FAILED
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).autoFillLog
      .update({
        where: { id: fillLog.id },
        data: {
          status: "FAILED",
          failureReason: `Internal error: ${error instanceof Error ? error.message : String(error)}`,
        },
      })
      .catch((e: unknown) =>
        log.error("[auto-fill] Failed to update log", { error: e }),
      );

    return {
      success: false,
      logId: fillLog.id,
      isEmergency,
      candidatesEvaluated: 0,
      failureReason: `Internal error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// "NO ONE AVAILABLE" PROTOCOL
// ═══════════════════════════════════════════════════════════════

/**
 * Handle the case where no eligible replacement is found.
 *
 * 1. Create ManagerAlert (URGENT)
 * 2. Update AutoFillLog → FAILED with compliance reason
 * 3. Notify all managers via in-app + email/push
 * 4. Audit log the failure
 *
 * Never overrides the right to disconnect — no employee is force-assigned.
 */
async function handleNoOneAvailable(params: {
  fillLogId: string;
  shiftId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shift: any;
  reason: string;
  isEmergency: boolean;
  candidatesEvaluated: number;
  workspaceId: string;
}): Promise<AutoFillResult> {
  const {
    fillLogId,
    shiftId,
    shift,
    reason,
    isEmergency,
    candidatesEvaluated,
    workspaceId,
  } = params;

  const shiftDateStr = new Date(shift.date).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const locationStr = shift.location?.name
    ? ` am Standort ${shift.location.name}`
    : "";

  const failureReason =
    candidatesEvaluated === 0
      ? "Kein Mitarbeiter verfügbar — alle im Urlaub, krank oder bereits eingeteilt."
      : `${candidatesEvaluated} Kandidat(en) geprüft — alle verletzten ArbZG-Vorschriften ` +
        `(max. 10h/Tag, 11h Ruhezeit, max. 48h/Woche).`;

  // 1. Update AutoFillLog → FAILED
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).autoFillLog.update({
    where: { id: fillLogId },
    data: {
      status: "FAILED",
      candidatesEvaluated,
      failureReason,
    },
  });

  // 2. Create ManagerAlert
  const severity = isEmergency ? "URGENT" : "WARNING";
  const alertTitle = isEmergency
    ? "⚠️ DRINGEND: Keine Vertretung gefunden"
    : "Keine Vertretung gefunden";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).managerAlert.create({
    data: {
      type: "NO_REPLACEMENT",
      title: alertTitle,
      message:
        `Für die Schicht am ${shiftDateStr} (${shift.startTime}–${shift.endTime})${locationStr} ` +
        `konnte keine automatische Vertretung gefunden werden. ${failureReason} ` +
        `Grund der Vakanz: ${reason}`,
      severity,
      link: "/schichtplan",
      metadata: JSON.stringify({
        shiftId,
        shiftDate: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        candidatesEvaluated,
        isEmergency,
      }),
      workspaceId,
    },
  });

  // 3. Notify managers
  await createSystemNotification({
    type: "AUTO_FILL_FAILED",
    title: alertTitle,
    message:
      `Für die Schicht am ${shiftDateStr} (${shift.startTime}–${shift.endTime})${locationStr} ` +
      `wurde keine Vertretung gefunden. ${failureReason} Bitte manuell zuweisen.`,
    link: "/schichtplan",
    workspaceId,
    recipientType: "managers",
  });

  // 4. Audit log
  createAuditLog({
    action: "CREATE",
    entityType: "auto-fill-failure",
    entityId: fillLogId,
    workspaceId,
    changes: {
      shiftId,
      reason,
      failureReason,
      isEmergency,
      candidatesEvaluated,
    },
  });

  log.warn("[auto-fill] No replacement found — manager alert created", {
    shiftId,
    isEmergency,
    candidatesEvaluated,
    failureReason,
  });

  return {
    success: false,
    logId: fillLogId,
    isEmergency,
    candidatesEvaluated,
    failureReason,
  };
}

// ═══════════════════════════════════════════════════════════════
// BATCH AUTO-FILL (for cascade absence)
// ═══════════════════════════════════════════════════════════════

/**
 * Run auto-fill for multiple shifts (e.g. after absence cascade cancels them).
 * Processes sequentially to avoid constraint conflicts between fills.
 */
export async function batchAutoFill(
  requests: AutoFillRequest[],
): Promise<AutoFillResult[]> {
  const results: AutoFillResult[] = [];
  for (const request of requests) {
    const result = await findAndAssignReplacement(request);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  log.info("[auto-fill] Batch complete", {
    total: requests.length,
    successful,
    failed,
  });

  return results;
}
