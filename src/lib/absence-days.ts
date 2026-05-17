/**
 * Holiday-aware absence day classification.
 *
 * Walks every calendar day in a [startDate, endDate] inclusive range and
 * tags it as WORK / WEEKEND / HOLIDAY / VACATION. Only VACATION days count
 * against the employee's vacation balance — statutory public holidays are
 * never deducted, even if they fall on what would otherwise be a working
 * day.
 *
 * The Bundesland used to look up holidays follows this priority:
 *   1. explicit `bundesland` parameter (preferred when caller already knows)
 *   2. Location.bundesland (the employee's primary work site)
 *   3. Workspace.bundesland (legacy default)
 *   4. "BE" (Berlin) as a final fallback
 */
import { prisma } from "@/lib/db";
import { isPublicHoliday } from "@/lib/holidays";

export type DayKind = "WORK" | "WEEKEND" | "HOLIDAY" | "VACATION";

export interface ClassifiedDay {
  date: string; // YYYY-MM-DD
  kind: DayKind;
  holidayName?: string;
}

export interface AbsenceDayClassification {
  breakdown: ClassifiedDay[];
  /** Number of working days the employee actually loses from their balance. */
  deductibleDays: number;
  /** Number of public holidays inside the range (informational). */
  holidayCount: number;
  /** Bundesland used for the classification (for UI display). */
  bundesland: string;
}

function toIso(date: Date): string {
  // Berlin tz-anchored ISO date (matches isPublicHoliday's internal format).
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Pure helper — does no DB work. Use when the caller has already resolved
 * which Bundesland to apply (e.g. inside transactions, in tests, in the
 * preview endpoint).
 */
export function classifyAbsenceDays(opts: {
  startDate: Date;
  endDate: Date;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  bundesland: string;
}): AbsenceDayClassification {
  const {
    startDate,
    endDate,
    halfDayStart = false,
    halfDayEnd = false,
    bundesland,
  } = opts;

  const breakdown: ClassifiedDay[] = [];
  let deductible = 0;
  let holidayCount = 0;

  // Normalise to midnight Berlin to avoid DST off-by-one when caller passes
  // a timestamp at e.g. 22:30 UTC the day before.
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const iso = toIso(d);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) {
      breakdown.push({ date: iso, kind: "WEEKEND" });
      continue;
    }
    const h = isPublicHoliday(d, bundesland);
    if (h.isHoliday) {
      holidayCount += 1;
      breakdown.push({ date: iso, kind: "HOLIDAY", holidayName: h.name });
      continue;
    }
    breakdown.push({ date: iso, kind: "VACATION" });
    deductible += 1;
  }

  // Half-day adjustments only apply when the *first* / *last* day is a real
  // vacation day. A half-day flag on a weekend or holiday is a no-op.
  if (halfDayStart && breakdown[0]?.kind === "VACATION") deductible -= 0.5;
  if (
    halfDayEnd &&
    breakdown.length > 0 &&
    breakdown[breakdown.length - 1]?.kind === "VACATION"
  ) {
    deductible -= 0.5;
  }

  return {
    breakdown,
    deductibleDays: Math.max(deductible, 0),
    holidayCount,
    bundesland,
  };
}

/**
 * Resolve which Bundesland applies for an employee/workspace combination,
 * following the priority order documented at the top of this file.
 */
export async function resolveBundesland(opts: {
  workspaceId: string;
  employeeId?: string | null;
  locationId?: string | null;
  override?: string | null;
}): Promise<string> {
  if (opts.override) return opts.override;

  if (opts.locationId) {
    const loc = await prisma.location.findUnique({
      where: { id: opts.locationId },
      select: { bundesland: true },
    });
    if (loc?.bundesland) return loc.bundesland;
  }

  if (opts.employeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: opts.employeeId },
      select: { locationId: true },
    });
    if (emp?.locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: emp.locationId },
        select: { bundesland: true },
      });
      if (loc?.bundesland) return loc.bundesland;
    }
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: opts.workspaceId },
    select: { bundesland: true },
  });
  return ws?.bundesland ?? "BE";
}

/**
 * Convenience: classify an absence by also resolving the right Bundesland
 * from the DB. Use this from API routes that already know workspace+employee.
 */
export async function classifyAbsenceForWorkspace(opts: {
  workspaceId: string;
  employeeId?: string | null;
  locationId?: string | null;
  bundeslandOverride?: string | null;
  startDate: Date;
  endDate: Date;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
}): Promise<AbsenceDayClassification> {
  const bundesland = await resolveBundesland({
    workspaceId: opts.workspaceId,
    employeeId: opts.employeeId,
    locationId: opts.locationId,
    override: opts.bundeslandOverride,
  });
  return classifyAbsenceDays({
    startDate: opts.startDate,
    endDate: opts.endDate,
    halfDayStart: opts.halfDayStart,
    halfDayEnd: opts.halfDayEnd,
    bundesland,
  });
}
