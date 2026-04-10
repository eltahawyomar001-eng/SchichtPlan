/**
 * Automations Engine
 *
 * Pure rule-based automations for the Shiftfy platform.
 * No AI/SLM — all logic is deterministic and based on German labor law (ArbZG).
 *
 * Categories:
 *  1. Shift conflict detection & rest-period enforcement
 *  2. Cascade updates on absence approval
 *  3. Notification creation helpers
 *  4. Auto-create time entries from past shifts
 *  5. Auto-calculate break deduction (ArbZG)
 *  6. Auto-update time account balances
 *  7. Recurring shift generation
 *  8. Auto-approve simple absences & swaps
 *  9. Overtime alerts
 * 10. Payroll auto-lock
 */

import { prisma } from "@/lib/db";
import { calcGrossMinutes } from "@/lib/time-utils";
import { dispatchExternalNotification, sendEmail } from "@/lib/notifications";
import { log } from "@/lib/logger";
import { batchAutoFill } from "@/lib/auto-fill";

// ═══════════════════════════════════════════════════════════════════
// AUTOMATION SETTINGS CHECK
// ═══════════════════════════════════════════════════════════════════

/** Default enabled state for all automation keys */
const AUTOMATION_DEFAULTS: Record<string, boolean> = {
  shiftConflictDetection: true,
  restPeriodEnforcement: true,
  cascadeAbsenceCancellation: true,
  autoCreateTimeEntries: true,
  legalBreakEnforcement: true,
  timeAccountRecalculation: true,
  recurringShifts: true,
  autoApproveAbsence: true,
  autoApproveSwap: true,
  overtimeAlerts: true,
  payrollAutoLock: true,
  notifications: true,
};

/**
 * Check whether a specific automation is enabled for a workspace.
 * Falls back to the default value if no explicit setting exists.
 */
export async function isAutomationEnabled(
  workspaceId: string,
  key: string,
): Promise<boolean> {
  try {
    const setting = await prisma.automationSetting.findUnique({
      where: { workspaceId_key: { workspaceId, key } },
    });
    if (setting) return setting.enabled;
    return AUTOMATION_DEFAULTS[key] ?? true;
  } catch {
    // If the table doesn't exist yet or query fails, default to enabled
    return AUTOMATION_DEFAULTS[key] ?? true;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1. SHIFT CONFLICT DETECTION & REST-PERIOD ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

export interface ShiftConflict {
  type:
    | "OVERLAP"
    | "ABSENCE"
    | "UNAVAILABLE"
    | "REST_PERIOD"
    | "MAX_DAILY_HOURS"
    | "MAX_WEEKLY_HOURS";
  message: string;
  /** ID of the conflicting record (shift, absence, availability) */
  conflictId?: string;
}

/** Minimum rest between shifts in hours (ArbZG §5: 11 hours) */
const MIN_REST_HOURS = 11;

/** Maximum daily working hours (ArbZG §3: normally 8h, extendable to 10h) */
const MAX_DAILY_HOURS = 10;

/** Maximum weekly working hours (ArbZG §3: 6 × 8h = 48h averaged) */
const MAX_WEEKLY_HOURS = 48;

/**
 * Check all conflicts for a proposed shift assignment.
 * Returns an empty array if no conflicts.
 */
export async function checkShiftConflicts(params: {
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  workspaceId: string;
  excludeShiftId?: string; // for editing an existing shift
}): Promise<ShiftConflict[]> {
  const { employeeId, date, startTime, endTime, workspaceId, excludeShiftId } =
    params;

  // Skip if conflict detection is disabled
  if (!(await isAutomationEnabled(workspaceId, "shiftConflictDetection"))) {
    return [];
  }

  const conflicts: ShiftConflict[] = [];
  const shiftDate = new Date(date);

  // ── 1a. Overlapping shifts on the same day ──
  const existingShifts = await prisma.shift.findMany({
    where: {
      employeeId,
      workspaceId,
      date: shiftDate,
      status: { not: "CANCELLED" },
      ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
    },
  });

  for (const existing of existingShifts) {
    if (
      timesOverlap(existing.startTime, existing.endTime, startTime, endTime)
    ) {
      conflicts.push({
        type: "OVERLAP",
        message: `Überlappung mit bestehender Schicht ${existing.startTime}–${existing.endTime}`,
        conflictId: existing.id,
      });
    }
  }

  // ── 1b. Approved absence covering this date ──
  const absences = await prisma.absenceRequest.findMany({
    where: {
      employeeId,
      status: "GENEHMIGT",
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate },
    },
  });

  if (absences.length > 0) {
    conflicts.push({
      type: "ABSENCE",
      message: `Mitarbeiter hat eine genehmigte Abwesenheit am ${date}`,
      conflictId: absences[0].id,
    });
  }

  // ── 1c. Employee marked as unavailable ──
  const dayOfWeek = shiftDate.getDay();
  // Convert JS getDay() (0=Sun) to our schema (0=Mon)
  const isoWeekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const unavailable = await prisma.availability.findMany({
    where: {
      employeeId,
      weekday: isoWeekday,
      type: "NICHT_VERFUEGBAR",
      validFrom: { lte: shiftDate },
      OR: [{ validUntil: null }, { validUntil: { gte: shiftDate } }],
    },
  });

  for (const entry of unavailable) {
    // If availability has time range, check overlap; if whole-day, always conflict
    if (entry.startTime && entry.endTime) {
      if (timesOverlap(entry.startTime, entry.endTime, startTime, endTime)) {
        conflicts.push({
          type: "UNAVAILABLE",
          message: `Mitarbeiter ist ${entry.startTime}–${entry.endTime} nicht verfügbar`,
          conflictId: entry.id,
        });
      }
    } else {
      conflicts.push({
        type: "UNAVAILABLE",
        message: `Mitarbeiter ist an diesem Wochentag nicht verfügbar`,
        conflictId: entry.id,
      });
    }
  }

  // ── 1d. Rest period violation (ArbZG §5: 11h between shifts) ──
  const restEnabled = await isAutomationEnabled(
    workspaceId,
    "restPeriodEnforcement",
  );
  if (restEnabled) {
    const prevDay = new Date(shiftDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const nextDay = new Date(shiftDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // ── Same-day rest period check ──
    // If there are other non-overlapping shifts on the same day,
    // check that the gap between them is >= 11 hours
    const newStart = toMinutes(startTime);
    let newEnd = toMinutes(endTime);
    if (newEnd <= newStart) newEnd += 1440; // overnight

    for (const existing of existingShifts) {
      const exStart = toMinutes(existing.startTime);
      let exEnd = toMinutes(existing.endTime);
      if (exEnd <= exStart) exEnd += 1440;

      // Only check rest period for non-overlapping shifts (overlaps caught in 1a)
      if (!(newStart < exEnd && exStart < newEnd)) {
        // Gap between: if new shift is after existing
        let gapMinutes: number;
        if (newStart >= exEnd) {
          gapMinutes = newStart - exEnd;
        } else {
          gapMinutes = exStart - newEnd;
        }

        if (gapMinutes < MIN_REST_HOURS * 60) {
          conflicts.push({
            type: "REST_PERIOD",
            message: `Nur ${Math.floor(gapMinutes / 60)}h ${gapMinutes % 60}min Ruhezeit zwischen Schichten am selben Tag (mind. ${MIN_REST_HOURS}h nötig, ArbZG §5)`,
            conflictId: existing.id,
          });
        }
      }
    }

    // Check previous day's shifts
    const prevShifts = await prisma.shift.findMany({
      where: {
        employeeId,
        workspaceId,
        date: prevDay,
        status: { not: "CANCELLED" },
      },
      orderBy: { endTime: "desc" },
      take: 1,
    });

    if (prevShifts.length > 0) {
      const prevEnd = prevShifts[0].endTime;
      const restMinutes = calcRestBetween(prevEnd, startTime, true);
      if (restMinutes < MIN_REST_HOURS * 60) {
        conflicts.push({
          type: "REST_PERIOD",
          message: `Nur ${Math.floor(restMinutes / 60)}h ${restMinutes % 60}min Ruhezeit nach vorheriger Schicht (mind. ${MIN_REST_HOURS}h nötig, ArbZG §5)`,
        });
      }
    }

    // Check next day's shifts
    const nextShifts = await prisma.shift.findMany({
      where: {
        employeeId,
        workspaceId,
        date: nextDay,
        status: { not: "CANCELLED" },
      },
      orderBy: { startTime: "asc" },
      take: 1,
    });

    if (nextShifts.length > 0) {
      const nextStart = nextShifts[0].startTime;
      const restMinutes = calcRestBetween(endTime, nextStart, true);
      if (restMinutes < MIN_REST_HOURS * 60) {
        conflicts.push({
          type: "REST_PERIOD",
          message: `Nur ${Math.floor(restMinutes / 60)}h ${restMinutes % 60}min Ruhezeit bis zur nächsten Schicht (mind. ${MIN_REST_HOURS}h nötig, ArbZG §5)`,
        });
      }
    }
  } // end restPeriodEnforcement check

  // ── 1e. Maximum daily working hours (ArbZG §3: max 10h/day) ──
  {
    const proposedMinutes = calcGrossMinutes(startTime, endTime);
    let totalDayMinutes = proposedMinutes;

    for (const existing of existingShifts) {
      totalDayMinutes += calcGrossMinutes(existing.startTime, existing.endTime);
    }

    const totalDayHours = totalDayMinutes / 60;
    if (totalDayHours > MAX_DAILY_HOURS) {
      conflicts.push({
        type: "MAX_DAILY_HOURS",
        message: `${totalDayHours.toFixed(1)}h Gesamtarbeitszeit am Tag überschreitet das Maximum von ${MAX_DAILY_HOURS}h (ArbZG §3)`,
      });
    }
  }

  // ── 1f. Maximum weekly working hours (ArbZG §3: max 48h/week) ──
  {
    const proposedMinutes = calcGrossMinutes(startTime, endTime);

    // Get the Monday and Sunday of the shift's week
    const dayOfWeek = shiftDate.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekMonday = new Date(shiftDate);
    weekMonday.setDate(shiftDate.getDate() + mondayOffset);
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekMonday.getDate() + 6);

    const weekShifts = await prisma.shift.findMany({
      where: {
        employeeId,
        workspaceId,
        date: { gte: weekMonday, lte: weekSunday },
        status: { not: "CANCELLED" },
        ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
      },
    });

    let totalWeekMinutes = proposedMinutes;
    for (const ws of weekShifts) {
      totalWeekMinutes += calcGrossMinutes(ws.startTime, ws.endTime);
    }

    const totalWeekHours = totalWeekMinutes / 60;
    if (totalWeekHours > MAX_WEEKLY_HOURS) {
      conflicts.push({
        type: "MAX_WEEKLY_HOURS",
        message: `${totalWeekHours.toFixed(1)}h Wochenarbeitszeit überschreitet das Maximum von ${MAX_WEEKLY_HOURS}h (ArbZG §3)`,
      });
    }
  }

  return conflicts;
}

// ═══════════════════════════════════════════════════════════════════
// 2. CASCADE UPDATES ON ABSENCE APPROVAL
// ═══════════════════════════════════════════════════════════════════

/**
 * When an absence is approved, cancel conflicting shifts
 * and create notifications for affected parties.
 */
export async function cascadeAbsenceApproval(params: {
  absenceId: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  workspaceId: string;
  reviewerId: string;
}) {
  const { employeeId, startDate, endDate, workspaceId } = params;

  // Skip if cascade cancellation is disabled
  if (!(await isAutomationEnabled(workspaceId, "cascadeAbsenceCancellation"))) {
    return { cancelledShifts: 0 };
  }

  // Find all shifts for this employee in the absence period
  const conflictingShifts = await prisma.shift.findMany({
    where: {
      employeeId,
      workspaceId,
      date: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
    include: { employee: true },
  });

  if (conflictingShifts.length === 0) return { cancelledShifts: 0 };

  // Cancel all conflicting shifts
  await prisma.shift.updateMany({
    where: {
      id: { in: conflictingShifts.map((s) => s.id) },
    },
    data: { status: "CANCELLED" },
  });

  // Notify managers about cancelled shifts needing coverage
  const employee = conflictingShifts[0].employee;
  const employeeName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : "Nicht zugewiesen";

  await createSystemNotification({
    type: "SHIFTS_CANCELLED_ABSENCE",
    title: "Schichten abgesagt wegen Abwesenheit",
    message: `${conflictingShifts.length} Schicht(en) von ${employeeName} wurden wegen genehmigter Abwesenheit abgesagt und benötigen Vertretung.`,
    link: "/schichtplan",
    workspaceId,
    recipientType: "managers",
  });

  // ── Auto-Fill: try to find replacements for each cancelled shift ──
  const autoFillRequests = conflictingShifts.map((shift) => ({
    shiftId: shift.id,
    vacatedByEmployeeId: employeeId,
    reason: `Genehmigte Abwesenheit von ${employeeName}`,
    workspaceId,
  }));

  // Fire-and-forget — don't block the absence approval response
  batchAutoFill(autoFillRequests).catch((err) =>
    log.error("[cascade] Auto-fill batch error:", { error: err }),
  );

  return { cancelledShifts: conflictingShifts.length };
}

// ═══════════════════════════════════════════════════════════════════
// 3. NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a system notification for managers or a specific employee.
 * Also dispatches to external channels (email, WhatsApp, SMS) based on user prefs.
 */
export async function createSystemNotification(params: {
  type: string;
  title: string;
  message: string;
  link?: string;
  workspaceId: string;
  recipientType: "managers" | "employee";
  employeeEmail?: string;
}) {
  const {
    type,
    title,
    message,
    link,
    workspaceId,
    recipientType,
    employeeEmail,
  } = params;

  // Skip if notifications are disabled
  if (!(await isAutomationEnabled(workspaceId, "notifications"))) {
    log.info("[notification] Skipped — notifications automation disabled");
    return;
  }

  log.info(
    `[notification] Creating: type=${type}, recipientType=${recipientType}, employeeEmail=${employeeEmail ?? "none"}`,
  );

  if (recipientType === "managers") {
    const managers = await prisma.user.findMany({
      where: {
        workspaceId,
        role: { in: ["OWNER", "ADMIN", "MANAGER"] },
      },
      select: { id: true },
    });

    log.info(`[notification] Found ${managers.length} managers`);

    await prisma.notification.createMany({
      data: managers.map((m) => ({
        type,
        title,
        message,
        link: link || null,
        userId: m.id,
        workspaceId,
      })),
    });

    // Dispatch external notifications in parallel
    // AWAIT so errors surface in Vercel logs
    try {
      await Promise.allSettled(
        managers.map((m) =>
          dispatchExternalNotification({
            userId: m.id,
            type,
            title,
            message,
            link,
          }),
        ),
      );
    } catch (err) {
      log.error("[notification] Manager dispatch error:", { error: err });
    }
  } else if (employeeEmail) {
    const user = await prisma.user.findUnique({
      where: { email: employeeEmail },
      select: { id: true },
    });

    log.info(
      `[notification] Lookup email=${employeeEmail}: User=${user ? user.id : "NOT found"}`,
    );

    if (user) {
      await prisma.notification.create({
        data: {
          type,
          title,
          message,
          link: link || null,
          userId: user.id,
          workspaceId,
        },
      });

      // Dispatch email notification
      try {
        await dispatchExternalNotification({
          userId: user.id,
          type,
          title,
          message,
          link,
        });
      } catch (err) {
        log.error("[notification] Dispatch error:", { error: err });
      }
    } else {
      log.info(
        `[notification] No User for ${employeeEmail} — sending direct email`,
      );
      // No User account for this employee — still send a direct email
      try {
        const result = await sendEmail({
          to: employeeEmail,
          type,
          title,
          message,
          link,
          locale: "de",
        });
        if (result.success) {
          log.info(`[notification] Direct email sent to ${employeeEmail}`);
        } else {
          log.error(
            `[notification] Direct email failed for ${employeeEmail}: ${result.error}`,
          );
        }
      } catch (err) {
        log.error("[notification] Direct email error:", { error: err });
      }
    }
  } else {
    log.warn(
      "[notification] recipientType=employee but no employeeEmail provided",
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. AUTO-CREATE TIME ENTRIES FROM PAST SHIFTS
// ═══════════════════════════════════════════════════════════════════

/**
 * For all shifts that have passed (date < today) and don't have a
 * linked TimeEntry yet, create draft entries automatically.
 *
 * Call via: POST /api/automations/generate-time-entries
 * Or via Vercel Cron at 02:00 daily.
 */
export async function generateTimeEntriesFromShifts(workspaceId: string) {
  // Skip if auto-create time entries is disabled
  if (!(await isAutomationEnabled(workspaceId, "autoCreateTimeEntries"))) {
    return { created: 0 };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  // Find completed/scheduled shifts with no linked time entry
  const shifts = await prisma.shift.findMany({
    where: {
      workspaceId,
      date: { lte: yesterday },
      status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] },
    },
    include: { employee: true },
  });

  let created = 0;

  for (const shift of shifts) {
    // Skip open shifts with no employee assigned
    if (!shift.employeeId) continue;

    // Check if a time entry already exists for this shift
    const existing = await prisma.timeEntry.findFirst({
      where: { shiftId: shift.id },
    });
    if (existing) continue;

    // Also check by employee+date+time to avoid duplicates
    const duplicate = await prisma.timeEntry.findFirst({
      where: {
        employeeId: shift.employeeId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: { not: "ZURUECKGEWIESEN" },
      },
    });
    if (duplicate) continue;

    // Calculate break using ArbZG rules
    const grossMinutes = calcGrossMinutes(shift.startTime, shift.endTime);
    const breakMinutes = calcLegalBreak(grossMinutes);
    const netMinutes = Math.max(0, grossMinutes - breakMinutes);

    await prisma.timeEntry.create({
      data: {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes,
        grossMinutes,
        netMinutes,
        employeeId: shift.employeeId,
        shiftId: shift.id,
        workspaceId,
        status: "ENTWURF",
      },
    });

    // Mark shift as completed
    await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "COMPLETED" },
    });

    created++;
  }

  return { created };
}

// ═══════════════════════════════════════════════════════════════════
// 5. AUTO-CALCULATE BREAK DEDUCTION (ArbZG)
// ═══════════════════════════════════════════════════════════════════

/**
 * German Arbeitszeitgesetz break rules:
 * - > 6 hours: minimum 30 minutes break
 * - > 9 hours: minimum 45 minutes break
 */
export function calcLegalBreak(grossMinutes: number): number {
  if (grossMinutes > 9 * 60) return 45;
  if (grossMinutes > 6 * 60) return 30;
  return 0;
}

/**
 * Ensure a time entry meets minimum break requirements.
 * Returns the adjusted break minutes (never less than the legal minimum).
 */
export function ensureLegalBreak(
  grossMinutes: number,
  providedBreakMinutes: number,
): number {
  const legalMin = calcLegalBreak(grossMinutes);
  return Math.max(providedBreakMinutes, legalMin);
}

// ═══════════════════════════════════════════════════════════════════
// 5b. ArbZG MAXIMUM WORK TIME & REST PERIOD ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

/** ArbZG §3: Maximum daily work time in minutes (10 hours). */
export const ARBZG_MAX_DAILY_MINUTES = 10 * 60; // 600 minutes

/** ArbZG §5: Minimum rest period between shifts in hours. */
export const ARBZG_MIN_REST_HOURS = 11;

/** Warning thresholds (minutes worked) for approaching max work time. */
export const ARBZG_WARNING_THRESHOLDS = {
  /** First warning: 8 hours */
  INFO: 8 * 60,
  /** Second warning: 9 hours */
  WARNING: 9 * 60,
  /** Final warning: 9.5 hours — approaching hard limit */
  CRITICAL: 9.5 * 60,
} as const;

/**
 * ArbZG §5: Check if the minimum rest period (11 hours) has been
 * observed since the last clock-out for this employee.
 *
 * @returns `{ allowed: true }` if clock-in is permitted, or
 *          `{ allowed: false, remainingMinutes, nextAllowedAt }` if not.
 */
export async function checkRestPeriod(
  employeeId: string,
  now: Date = new Date(),
): Promise<
  | { allowed: true }
  | { allowed: false; remainingMinutes: number; nextAllowedAt: Date }
> {
  const lastEntry = await prisma.timeEntry.findFirst({
    where: {
      employeeId,
      clockOutAt: { not: null },
    },
    orderBy: { clockOutAt: "desc" },
    select: { clockOutAt: true },
  });

  if (!lastEntry?.clockOutAt) return { allowed: true };

  const restMs = now.getTime() - lastEntry.clockOutAt.getTime();
  const restMinutes = restMs / 60000;
  const requiredMinutes = ARBZG_MIN_REST_HOURS * 60;

  if (restMinutes >= requiredMinutes) return { allowed: true };

  const remainingMinutes = Math.ceil(requiredMinutes - restMinutes);
  const nextAllowedAt = new Date(
    lastEntry.clockOutAt.getTime() + requiredMinutes * 60000,
  );
  return { allowed: false, remainingMinutes, nextAllowedAt };
}

/**
 * ArbZG §3: Check how many minutes the employee has already worked today
 * (completed entries + any currently running entry).
 *
 * @returns Total gross minutes worked today (excluding the currently open entry).
 */
export async function getTodayWorkedMinutes(
  employeeId: string,
  todayDate: Date,
  tz: string = "Europe/Berlin",
): Promise<number> {
  // Get today's start/end in the employee's timezone
  const localNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: tz }),
  );
  const todayStart = new Date(localNow);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(localNow);
  todayEnd.setHours(23, 59, 59, 999);

  const completedEntries = await prisma.timeEntry.findMany({
    where: {
      employeeId,
      clockOutAt: { not: null },
      clockInAt: { gte: todayStart, lte: todayEnd },
    },
    select: { grossMinutes: true },
  });

  return completedEntries.reduce((sum, e) => sum + (e.grossMinutes ?? 0), 0);
}

/**
 * ArbZG §3: Check if the employee is allowed to clock in based on the
 * maximum daily work time (10 hours).
 *
 * @returns `{ allowed: true, todayWorkedMinutes, remainingMinutes }` or
 *          `{ allowed: false, todayWorkedMinutes }` if 10h is already reached.
 */
export async function checkMaxDailyWorkTime(
  employeeId: string,
  todayDate: Date,
  tz?: string,
): Promise<
  | { allowed: true; todayWorkedMinutes: number; remainingMinutes: number }
  | { allowed: false; todayWorkedMinutes: number }
> {
  const todayWorkedMinutes = await getTodayWorkedMinutes(
    employeeId,
    todayDate,
    tz,
  );

  if (todayWorkedMinutes >= ARBZG_MAX_DAILY_MINUTES) {
    return { allowed: false, todayWorkedMinutes };
  }

  return {
    allowed: true,
    todayWorkedMinutes,
    remainingMinutes: ARBZG_MAX_DAILY_MINUTES - todayWorkedMinutes,
  };
}

/**
 * ArbZG §3: Cap the gross work time at the maximum daily limit and compute
 * the capped net minutes. Used during clock-out.
 *
 * @returns The capped gross and net minutes, plus a flag indicating whether
 *          the time was capped.
 */
export function capWorkTimeAtLimit(
  grossMinutes: number,
  breakMinutes: number,
  todayPreviousGrossMinutes: number,
): {
  cappedGross: number;
  cappedNet: number;
  wasCapped: boolean;
  breakMinutes: number;
} {
  const totalGross = todayPreviousGrossMinutes + grossMinutes;
  const overLimit = totalGross - ARBZG_MAX_DAILY_MINUTES;

  if (overLimit <= 0) {
    // Not over the limit — apply legal break enforcement as usual
    const legalBreak = ensureLegalBreak(grossMinutes, breakMinutes);
    const net = Math.max(0, grossMinutes - legalBreak);
    return {
      cappedGross: grossMinutes,
      cappedNet: net,
      wasCapped: false,
      breakMinutes: legalBreak,
    };
  }

  // Cap: only allow the remaining minutes until 10h total
  const allowedGross = Math.max(0, grossMinutes - overLimit);
  const legalBreak = ensureLegalBreak(allowedGross, breakMinutes);
  const net = Math.max(0, allowedGross - legalBreak);

  return {
    cappedGross: allowedGross,
    cappedNet: net,
    wasCapped: true,
    breakMinutes: legalBreak,
  };
}

/**
 * Determine the ArbZG warning level based on current elapsed work minutes.
 */
export function getArbZGWarningLevel(
  currentMinutes: number,
): "NONE" | "INFO" | "WARNING" | "CRITICAL" | "EXCEEDED" {
  if (currentMinutes >= ARBZG_MAX_DAILY_MINUTES) return "EXCEEDED";
  if (currentMinutes >= ARBZG_WARNING_THRESHOLDS.CRITICAL) return "CRITICAL";
  if (currentMinutes >= ARBZG_WARNING_THRESHOLDS.WARNING) return "WARNING";
  if (currentMinutes >= ARBZG_WARNING_THRESHOLDS.INFO) return "INFO";
  return "NONE";
}

// ═══════════════════════════════════════════════════════════════════
// 6. AUTO-UPDATE TIME ACCOUNT BALANCES
// ═══════════════════════════════════════════════════════════════════

/**
 * Recalculate an employee's time account balance after a time entry
 * is confirmed (status → BESTAETIGT).
 */
export async function recalculateTimeAccount(employeeId: string) {
  const account = await prisma.timeAccount.findUnique({
    where: { employeeId },
    include: { employee: true },
  });

  if (!account) return null;

  // Skip if time account recalculation is disabled
  if (
    !(await isAutomationEnabled(
      account.workspaceId,
      "timeAccountRecalculation",
    ))
  ) {
    return null;
  }

  // Sum all confirmed net minutes since period start
  const result = await prisma.timeEntry.aggregate({
    where: {
      employeeId,
      status: "BESTAETIGT",
      date: { gte: account.periodStart },
    },
    _sum: { netMinutes: true },
  });

  const workedMinutes = result._sum.netMinutes || 0;

  // Calculate expected minutes
  const now = new Date();
  const periodStart = new Date(account.periodStart);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(
    1,
    Math.ceil((now.getTime() - periodStart.getTime()) / msPerWeek),
  );
  const expectedMinutes = weeks * account.contractHours * 60;

  const currentBalance =
    account.carryoverMinutes + workedMinutes - expectedMinutes;

  const updated = await prisma.timeAccount.update({
    where: { employeeId },
    data: {
      currentBalance: Math.round(currentBalance),
      lastCalculated: new Date(),
    },
  });

  return updated;
}

// ═══════════════════════════════════════════════════════════════════
// 7. RECURRING SHIFTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create recurring copies of a shift for N weeks.
 * Runs conflict checks on each — skips weeks with conflicts.
 */
export async function createRecurringShifts(params: {
  baseShift: {
    date: string;
    startTime: string;
    endTime: string;
    employeeId: string;
    locationId?: string | null;
    notes?: string | null;
  };
  repeatWeeks: number; // 1–52
  workspaceId: string;
}): Promise<{ created: number; skipped: number; conflicts: string[] }> {
  const { baseShift, repeatWeeks, workspaceId } = params;
  let created = 0;
  let skipped = 0;
  const conflictMessages: string[] = [];

  for (let week = 1; week <= repeatWeeks; week++) {
    const newDate = new Date(baseShift.date);
    newDate.setDate(newDate.getDate() + week * 7);
    const dateStr = newDate.toISOString().split("T")[0];

    // Check for conflicts
    const conflicts = await checkShiftConflicts({
      employeeId: baseShift.employeeId,
      date: dateStr,
      startTime: baseShift.startTime,
      endTime: baseShift.endTime,
      workspaceId,
    });

    if (conflicts.length > 0) {
      skipped++;
      conflictMessages.push(`KW+${week} (${dateStr}): ${conflicts[0].message}`);
      continue;
    }

    await prisma.shift.create({
      data: {
        date: new Date(dateStr),
        startTime: baseShift.startTime,
        endTime: baseShift.endTime,
        notes: baseShift.notes || null,
        employeeId: baseShift.employeeId,
        locationId: baseShift.locationId || null,
        workspaceId,
      },
    });

    created++;
  }

  return { created, skipped, conflicts: conflictMessages };
}

// ═══════════════════════════════════════════════════════════════════
// 8. AUTO-APPROVE SIMPLE ABSENCES & SWAPS
// ═══════════════════════════════════════════════════════════════════

/**
 * Auto-approve an absence request — ONLY for KRANK (sick leave).
 *
 * German industry standard (BUrlG / ArbZG):
 *  - KRANK: Employer must accept sick notes; auto-approve is standard.
 *  - URLAUB: Requires explicit manager approval (team coverage, quotas,
 *    business needs must be evaluated). §7 BUrlG gives the employer the
 *    right to schedule vacations considering operational requirements.
 *  - All other categories (SONDERURLAUB, ELTERNZEIT, UNBEZAHLT,
 *    FORTBILDUNG, SONSTIGES): Require human review.
 *
 * Returns true if auto-approved.
 */
export async function tryAutoApproveAbsence(
  absenceId: string,
): Promise<boolean> {
  const absence = await prisma.absenceRequest.findUnique({
    where: { id: absenceId },
    include: { employee: true },
  });

  if (!absence || absence.status !== "AUSSTEHEND") return false;

  // Skip if auto-approve absence is disabled
  if (!(await isAutomationEnabled(absence.workspaceId, "autoApproveAbsence"))) {
    return false;
  }

  // Only auto-approve sick leave — all other categories require manager review
  if (absence.category !== "KRANK") {
    return false;
  }

  await prisma.absenceRequest.update({
    where: { id: absenceId },
    data: {
      status: "GENEHMIGT",
      reviewedAt: new Date(),
      reviewNote: "Automatisch genehmigt (Krankmeldung)",
    },
  });

  await cascadeAbsenceApproval({
    absenceId,
    employeeId: absence.employeeId,
    startDate: absence.startDate,
    endDate: absence.endDate,
    workspaceId: absence.workspaceId,
    reviewerId: "system",
  });

  return true;
}

/**
 * Auto-approve a shift swap if both employees have no conflicts
 * after the swap would be executed.
 */
export async function tryAutoApproveSwap(swapId: string): Promise<boolean> {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    include: { shift: true, targetShift: true },
  });

  if (!swap || swap.status !== "ANGENOMMEN" || !swap.targetId) return false;

  // Skip if auto-approve swap is disabled
  if (!(await isAutomationEnabled(swap.workspaceId, "autoApproveSwap"))) {
    return false;
  }

  // Check: can targetId work the requester's shift?
  const targetConflicts = await checkShiftConflicts({
    employeeId: swap.targetId,
    date: swap.shift.date.toISOString().split("T")[0],
    startTime: swap.shift.startTime,
    endTime: swap.shift.endTime,
    workspaceId: swap.workspaceId,
    excludeShiftId: swap.targetShiftId || undefined,
  });

  if (targetConflicts.length > 0) return false;

  // If two-way swap, check reverse too
  if (swap.targetShift) {
    const requesterConflicts = await checkShiftConflicts({
      employeeId: swap.requesterId,
      date: swap.targetShift.date.toISOString().split("T")[0],
      startTime: swap.targetShift.startTime,
      endTime: swap.targetShift.endTime,
      workspaceId: swap.workspaceId,
      excludeShiftId: swap.shiftId,
    });

    if (requesterConflicts.length > 0) return false;
  }

  // No conflicts — auto-approve and execute
  if (swap.targetShiftId) {
    // Two-way swap
    await prisma.$transaction([
      prisma.shift.update({
        where: { id: swap.shiftId },
        data: { employeeId: swap.targetId },
      }),
      prisma.shift.update({
        where: { id: swap.targetShiftId },
        data: { employeeId: swap.requesterId },
      }),
      prisma.shiftSwapRequest.update({
        where: { id: swapId },
        data: {
          status: "ABGESCHLOSSEN",
          reviewedAt: new Date(),
          reviewNote: "Automatisch genehmigt (keine Konflikte)",
        },
      }),
    ]);
  } else {
    // One-way swap
    await prisma.$transaction([
      prisma.shift.update({
        where: { id: swap.shiftId },
        data: { employeeId: swap.targetId },
      }),
      prisma.shiftSwapRequest.update({
        where: { id: swapId },
        data: {
          status: "ABGESCHLOSSEN",
          reviewedAt: new Date(),
          reviewNote: "Automatisch genehmigt (keine Konflikte)",
        },
      }),
    ]);
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════
// 9. OVERTIME ALERTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check all employees with time accounts for overtime this week.
 * Creates notifications for managers when employees exceed contracted hours.
 */
export async function checkOvertimeAlerts(workspaceId: string) {
  // Skip if overtime alerts are disabled
  if (!(await isAutomationEnabled(workspaceId, "overtimeAlerts"))) {
    return { alerts: [] };
  }

  const accounts = await prisma.timeAccount.findMany({
    where: { workspaceId },
    include: { employee: true },
  });

  const alerts: string[] = [];

  // Get current week boundaries
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  for (const account of accounts) {
    const weeklyEntries = await prisma.timeEntry.aggregate({
      where: {
        employeeId: account.employeeId,
        date: { gte: weekStart, lte: weekEnd },
        status: { in: ["BESTAETIGT", "GEPRUEFT", "EINGEREICHT"] },
      },
      _sum: { netMinutes: true },
    });

    const workedMinutes = weeklyEntries._sum.netMinutes || 0;
    const contractMinutes = account.contractHours * 60;

    if (workedMinutes > contractMinutes) {
      const overtimeHours = ((workedMinutes - contractMinutes) / 60).toFixed(1);
      const name = `${account.employee.firstName} ${account.employee.lastName}`;
      alerts.push(`${name}: ${overtimeHours}h Überstunden`);
    }
  }

  if (alerts.length > 0) {
    await createSystemNotification({
      type: "OVERTIME_ALERT",
      title: `Überstunden-Warnung (${alerts.length} Mitarbeiter)`,
      message: alerts.join("; "),
      link: "/zeitkonten",
      workspaceId,
      recipientType: "managers",
    });
  }

  return { alerts };
}

// ═══════════════════════════════════════════════════════════════════
// 10. PAYROLL AUTO-LOCK
// ═══════════════════════════════════════════════════════════════════

/**
 * Lock all time entries for a given month (prevents further edits).
 * Grace period: 5 days after month end.
 *
 * Locking = setting status to BESTAETIGT for all GEPRUEFT entries
 * and preventing edits on any BESTAETIGT entry in that range.
 */
export async function lockMonthTimeEntries(
  workspaceId: string,
  year: number,
  month: number, // 1-12
) {
  // Skip if payroll auto-lock is disabled
  if (!(await isAutomationEnabled(workspaceId, "payrollAutoLock"))) {
    return { locked: 0, month: `${year}-${String(month).padStart(2, "0")}` };
  }

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last day of month

  // Auto-confirm all reviewed entries
  const result = await prisma.timeEntry.updateMany({
    where: {
      workspaceId,
      date: { gte: monthStart, lte: monthEnd },
      status: "GEPRUEFT",
    },
    data: {
      status: "BESTAETIGT",
      confirmedAt: new Date(),
      confirmedBy: "system-autolock",
    },
  });

  return {
    locked: result.count,
    month: `${year}-${String(month).padStart(2, "0")}`,
  };
}

/**
 * Check if a time entry's month is locked (past grace period).
 * Grace period: 5 days after the month ends.
 */
export function isMonthLocked(entryDate: Date): boolean {
  const now = new Date();
  const entryMonth = new Date(
    entryDate.getFullYear(),
    entryDate.getMonth() + 1,
    0,
  );
  const gracePeriodEnd = new Date(entryMonth);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);
  return now > gracePeriodEnd;
}

// ═══════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════

/** Parse "HH:mm" to minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Check if two time ranges overlap */
function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const a0 = toMinutes(aStart);
  let a1 = toMinutes(aEnd);
  if (a1 <= a0) a1 += 1440;
  const b0 = toMinutes(bStart);
  let b1 = toMinutes(bEnd);
  if (b1 <= b0) b1 += 1440;
  return a0 < b1 && b0 < a1;
}

/**
 * Calculate rest minutes between end of one shift and start of next.
 * @param crossDay true if the two times are on consecutive days
 */
function calcRestBetween(
  endTime: string,
  startTime: string,
  crossDay: boolean,
): number {
  const endMin = toMinutes(endTime);
  const startMin = toMinutes(startTime);
  if (crossDay) {
    // End is on day N, start is on day N+1
    return 1440 - endMin + startMin;
  }
  return startMin - endMin;
}

// ═══════════════════════════════════════════════════════════════════
// 11. CUSTOM AUTOMATION RULE EXECUTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Supported action types for custom automation rules:
 *
 * - send_notification: Creates an in-app notification
 *   { type: "send_notification", title: string, message: string, employeeId?: string }
 *
 * - send_email: Sends an email notification
 *   { type: "send_email", subject: string, body: string }
 *
 * - apply_surcharge: Records a surcharge percentage in remarks
 *   { type: "apply_surcharge", percentage: number, label: string }
 */

interface RuleAction {
  type: "send_notification" | "send_email" | "apply_surcharge";
  [key: string]: unknown;
}

interface RuleCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "gte" | "lte";
  value: unknown;
}

/**
 * Execute all active custom automation rules matching a given trigger.
 *
 * @param trigger - The event trigger (e.g. "shift.created", "time-entry.submitted")
 * @param workspaceId - The workspace ID to scope rules
 * @param context - Event context data (the created/updated entity)
 */
export async function executeCustomRules(
  trigger: string,
  workspaceId: string,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    if (!(await isAutomationEnabled(workspaceId, "notifications"))) return;

    const rules = await prisma.automationRule.findMany({
      where: { workspaceId, trigger, isActive: true },
    });

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      try {
        const conditions: RuleCondition[] = JSON.parse(rule.conditions || "[]");
        const actions: RuleAction[] = JSON.parse(rule.actions || "[]");

        // Check all conditions
        if (!evaluateConditions(conditions, context)) continue;

        // Execute all actions
        for (const action of actions) {
          await executeAction(action, workspaceId, context);
        }

        // Update lastTriggered
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastTriggered: new Date() },
        });
      } catch (err) {
        log.error("Error executing automation rule", {
          ruleId: rule.id,
          trigger,
          error: err,
        });
      }
    }
  } catch (err) {
    log.error("Error fetching automation rules", { trigger, error: err });
  }
}

/** Evaluate all conditions against the event context */
function evaluateConditions(
  conditions: RuleCondition[],
  context: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((c) => {
    const fieldValue = context[c.field];
    switch (c.operator) {
      case "equals":
        return fieldValue === c.value;
      case "not_equals":
        return fieldValue !== c.value;
      case "contains":
        return (
          typeof fieldValue === "string" &&
          typeof c.value === "string" &&
          fieldValue.toLowerCase().includes(c.value.toLowerCase())
        );
      case "gt":
        return typeof fieldValue === "number" && fieldValue > Number(c.value);
      case "lt":
        return typeof fieldValue === "number" && fieldValue < Number(c.value);
      case "gte":
        return typeof fieldValue === "number" && fieldValue >= Number(c.value);
      case "lte":
        return typeof fieldValue === "number" && fieldValue <= Number(c.value);
      default:
        return true;
    }
  });
}

/** Execute a single action */
async function executeAction(
  action: RuleAction,
  workspaceId: string,
  context: Record<string, unknown>,
): Promise<void> {
  switch (action.type) {
    case "send_notification": {
      const employeeEmail =
        (action.employeeEmail as string) || (context.employeeEmail as string);
      if (!employeeEmail) break;
      await createSystemNotification({
        workspaceId,
        recipientType: "employee",
        employeeEmail,
        title: interpolate(action.title as string, context),
        message: interpolate(action.message as string, context),
        type: "AUTOMATION",
      });
      break;
    }

    case "send_email": {
      const email = (action.to as string) || (context.employeeEmail as string);
      if (!email) break;
      await sendEmail({
        to: email,
        type: "AUTOMATION",
        title: interpolate(action.title as string, context),
        message: interpolate(action.message as string, context),
      });
      break;
    }

    case "apply_surcharge": {
      const entryId = context.id as string;
      if (!entryId) break;
      const pct = Number(action.percentage) || 0;
      const label = (action.label as string) || "Zuschlag";
      try {
        const existing = await prisma.timeEntry.findUnique({
          where: { id: entryId },
        });
        if (existing) {
          const remarkSuffix = `[${label}: +${pct}%]`;
          const remarks = existing.remarks
            ? `${existing.remarks} ${remarkSuffix}`
            : remarkSuffix;
          await prisma.timeEntry.update({
            where: { id: entryId },
            data: { remarks },
          });
        }
      } catch {
        // Silently skip if entry doesn't exist
      }
      break;
    }

    default:
      log.warn("Unknown automation action type", {
        type: action.type,
        workspaceId,
      });
  }
}

/** Replace {{field}} placeholders in strings with context values */
function interpolate(
  template: string | undefined,
  context: Record<string, unknown>,
): string {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val != null ? String(val) : "";
  });
}
