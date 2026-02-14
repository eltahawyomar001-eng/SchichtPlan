/**
 * Automations Engine
 *
 * Pure rule-based automations for the SchichtPlan platform.
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

// ═══════════════════════════════════════════════════════════════════
// 1. SHIFT CONFLICT DETECTION & REST-PERIOD ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

export interface ShiftConflict {
  type: "OVERLAP" | "ABSENCE" | "UNAVAILABLE" | "REST_PERIOD";
  message: string;
  /** ID of the conflicting record (shift, absence, availability) */
  conflictId?: string;
}

/** Minimum rest between shifts in hours (ArbZG §5: 11 hours) */
const MIN_REST_HOURS = 11;

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
  const prevDay = new Date(shiftDate);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(shiftDate);
  nextDay.setDate(nextDay.getDate() + 1);

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
  const { employeeId, startDate, endDate, workspaceId, reviewerId } = params;

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
  const employeeName = `${employee.firstName} ${employee.lastName}`;

  await createSystemNotification({
    type: "SHIFTS_CANCELLED_ABSENCE",
    title: "Schichten abgesagt wegen Abwesenheit",
    message: `${conflictingShifts.length} Schicht(en) von ${employeeName} wurden wegen genehmigter Abwesenheit abgesagt und benötigen Vertretung.`,
    link: "/schichtplan",
    workspaceId,
    recipientType: "managers",
  });

  return { cancelledShifts: conflictingShifts.length };
}

// ═══════════════════════════════════════════════════════════════════
// 3. NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a system notification for managers or a specific employee.
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

  if (recipientType === "managers") {
    const managers = await prisma.user.findMany({
      where: {
        workspaceId,
        role: { in: ["OWNER", "ADMIN", "MANAGER"] },
      },
      select: { id: true },
    });

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
  } else if (employeeEmail) {
    const user = await prisma.user.findUnique({
      where: { email: employeeEmail },
      select: { id: true },
    });
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
    }
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
 * Auto-approve an absence request if:
 * 1. Category is KRANK (sick leave — always auto-approve)
 * 2. No conflicting shifts exist
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

  // Auto-approve sick leave immediately
  if (absence.category === "KRANK") {
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

  // For other categories: auto-approve if no conflicting shifts
  const conflictingShifts = await prisma.shift.findMany({
    where: {
      employeeId: absence.employeeId,
      workspaceId: absence.workspaceId,
      date: { gte: absence.startDate, lte: absence.endDate },
      status: { not: "CANCELLED" },
    },
  });

  if (conflictingShifts.length === 0) {
    await prisma.absenceRequest.update({
      where: { id: absenceId },
      data: {
        status: "GENEHMIGT",
        reviewedAt: new Date(),
        reviewNote: "Automatisch genehmigt (keine Konflikte)",
      },
    });
    return true;
  }

  return false;
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
