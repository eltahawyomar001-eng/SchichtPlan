/**
 * Payroll engine — full monthly gross-wage computation.
 *
 * Beyond a raw hours export, this computes:
 *   • base wage   = confirmed worked hours × hourly rate
 *   • surcharges  = night / Sunday / holiday premiums (from the shift's
 *                   surchargePercent and flags)
 *   • continued pay (Entgeltfortzahlung) = approved PAID absences (vacation,
 *                   sick, special leave, training) valued by the
 *                   Lohnausfallprinzip approximation: working days × average
 *                   daily hours × rate.
 *
 * All money in integer cents. Results are an estimate intended for review and
 * DATEV hand-off — not a substitute for a Steuerberater's final calculation.
 */

import { prisma } from "@/lib/db";

export type SurchargeType = "NIGHT" | "SUNDAY" | "HOLIDAY" | "NONE";

export interface PayrollLine {
  employeeId: string;
  name: string;
  hourlyRateCents: number;
  workedMinutes: number;
  baseCents: number;
  surchargeCents: number;
  surchargeByType: { NIGHT: number; SUNDAY: number; HOLIDAY: number };
  absencePaidDays: number;
  continuedPayCents: number;
  grossCents: number;
}

export interface PayrollResult {
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  lines: PayrollLine[];
  totals: {
    baseCents: number;
    surchargeCents: number;
    continuedPayCents: number;
    grossCents: number;
    employees: number;
  };
  /**
   * Number of ENTWURF (draft) time entries in this period that are NOT yet
   * counted in payroll. Drafts only enter payroll once submitted/approved
   * (PAYABLE_STATUSES). Surfaced so admins know unfinished entries exist.
   */
  draftCount: number;
  generatedAt: string;
}

/** Time-entry statuses that count toward payroll (everything reviewed/submitted, not drafts/rejected). */
const PAYABLE_STATUSES = ["EINGEREICHT", "GEPRUEFT", "BESTAETIGT"] as const;

/** Absence categories that are paid by the employer (Entgeltfortzahlung). */
const PAID_ABSENCE_CATEGORIES = [
  "URLAUB",
  "KRANK",
  "SONDERURLAUB",
  "FORTBILDUNG",
] as const;

function topSurcharge(flags: {
  isHolidayShift: boolean;
  isSundayShift: boolean;
  isNightShift: boolean;
}): SurchargeType {
  if (flags.isHolidayShift) return "HOLIDAY";
  if (flags.isSundayShift) return "SUNDAY";
  if (flags.isNightShift) return "NIGHT";
  return "NONE";
}

/** Count Mon–Fri working days in [from, to] (inclusive), both clamped already. */
function countWorkingDays(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export async function computePayroll(
  workspaceId: string,
  year: number,
  month: number,
): Promise<PayrollResult> {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0); // last day of month
  periodEnd.setHours(23, 59, 59, 999);

  const [employees, entries, absences, draftCount] = await Promise.all([
    prisma.employee.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        hourlyRate: true,
        weeklyHours: true,
        workDaysPerWeek: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: { in: [...PAYABLE_STATUSES] },
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { employeeId: true, netMinutes: true, shiftId: true },
    }),
    prisma.absenceRequest.findMany({
      where: {
        workspaceId,
        status: "GENEHMIGT",
        category: { in: [...PAID_ABSENCE_CATEGORIES] },
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
        halfDayStart: true,
        halfDayEnd: true,
      },
    }),
    // Draft (ENTWURF) entries in the period — not yet payable. Counted so the
    // Abrechnung can warn admins that unfinished entries exist for the period.
    prisma.timeEntry.count({
      where: {
        workspaceId,
        deletedAt: null,
        status: "ENTWURF",
        date: { gte: periodStart, lte: periodEnd },
      },
    }),
  ]);

  // Surcharge lookup for the period's shifts (TimeEntry.shiftId is a plain id).
  const shiftIds = entries
    .map((e) => e.shiftId)
    .filter((s): s is string => !!s);
  const shifts = shiftIds.length
    ? await prisma.shift.findMany({
        where: { id: { in: shiftIds }, workspaceId },
        select: {
          id: true,
          surchargePercent: true,
          isNightShift: true,
          isSundayShift: true,
          isHolidayShift: true,
        },
      })
    : [];
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const lineByEmployee = new Map<string, PayrollLine>();
  for (const e of employees) {
    lineByEmployee.set(e.id, {
      employeeId: e.id,
      name: `${e.lastName}, ${e.firstName}`,
      hourlyRateCents: Math.round((e.hourlyRate ?? 0) * 100),
      workedMinutes: 0,
      baseCents: 0,
      surchargeCents: 0,
      surchargeByType: { NIGHT: 0, SUNDAY: 0, HOLIDAY: 0 },
      absencePaidDays: 0,
      continuedPayCents: 0,
      grossCents: 0,
    });
  }

  // ── Base wage + surcharges from worked time ──
  for (const entry of entries) {
    const line = lineByEmployee.get(entry.employeeId);
    if (!line) continue; // inactive/deleted employee — skip
    const rate = line.hourlyRateCents;
    const hours = entry.netMinutes / 60;
    const baseCents = Math.round(hours * rate);
    line.workedMinutes += entry.netMinutes;
    line.baseCents += baseCents;

    const shift = entry.shiftId ? shiftById.get(entry.shiftId) : undefined;
    if (shift && shift.surchargePercent > 0) {
      const sCents = Math.round((baseCents * shift.surchargePercent) / 100);
      line.surchargeCents += sCents;
      const type = topSurcharge(shift);
      if (type !== "NONE") line.surchargeByType[type] += sCents;
    }
  }

  // ── Continued pay (Entgeltfortzahlung) for approved paid absences ──
  for (const abs of absences) {
    const line = lineByEmployee.get(abs.employeeId);
    if (!line) continue;
    const emp = employees.find((e) => e.id === abs.employeeId);
    if (!emp) continue;

    const start = abs.startDate < periodStart ? periodStart : abs.startDate;
    const end = abs.endDate > periodEnd ? periodEnd : abs.endDate;
    let days = countWorkingDays(start, end);
    // Half-day adjustments only when the boundary day falls inside the period.
    if (abs.halfDayStart && abs.startDate >= periodStart) days -= 0.5;
    if (abs.halfDayEnd && abs.endDate <= periodEnd) days -= 0.5;
    if (days <= 0) continue;

    const workDays = emp.workDaysPerWeek > 0 ? emp.workDaysPerWeek : 5;
    const dailyHours = emp.weeklyHours ? emp.weeklyHours / workDays : 8;
    const continuedCents = Math.round(days * dailyHours * line.hourlyRateCents);
    line.absencePaidDays += days;
    line.continuedPayCents += continuedCents;
  }

  const lines = [...lineByEmployee.values()]
    .map((l) => ({
      ...l,
      grossCents: l.baseCents + l.surchargeCents + l.continuedPayCents,
    }))
    // Only employees with something to pay this period.
    .filter((l) => l.grossCents > 0 || l.workedMinutes > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totals = lines.reduce(
    (acc, l) => ({
      baseCents: acc.baseCents + l.baseCents,
      surchargeCents: acc.surchargeCents + l.surchargeCents,
      continuedPayCents: acc.continuedPayCents + l.continuedPayCents,
      grossCents: acc.grossCents + l.grossCents,
      employees: acc.employees + 1,
    }),
    {
      baseCents: 0,
      surchargeCents: 0,
      continuedPayCents: 0,
      grossCents: 0,
      employees: 0,
    },
  );

  return {
    year,
    month,
    periodStart: periodStart.toLocaleDateString("en-CA"),
    periodEnd: periodEnd.toLocaleDateString("en-CA"),
    lines,
    totals,
    draftCount,
    generatedAt: new Date().toISOString(),
  };
}
