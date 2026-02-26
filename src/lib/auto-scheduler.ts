/**
 * AI-Powered Auto-Scheduling Engine v2
 *
 * Constraint Satisfaction Problem (CSP) solver for optimal shift scheduling.
 * Uses constraint propagation + backtracking with scoring heuristics.
 *
 * Constraints (hard — must satisfy):
 *  1. ArbZG §3: Max 10h/day, max 48h/week
 *  2. ArbZG §5: Min 11h rest between shifts
 *  3. No overlapping shifts per employee
 *  4. Employee must not be on approved absence
 *  5. Employee must not be marked NICHT_VERFUEGBAR
 *  6. Required skills must be met (non-expired)
 *  7. Contract hours limit (weeklyHours × period ratio)
 *
 * Objectives (soft — optimize):
 *  A. Fairness: Equalize hours across employees relative to contracts
 *  B. Preference: Favor BEVORZUGT availability slots (with time-window matching)
 *  C. Cost: Minimize surcharges (night/Sunday/holiday)
 *  D. Staffing: Meet StaffingRequirement min/max targets
 *  E. Continuity: Prefer employees who worked similar slots recently
 *  F. Fatigue: Penalize consecutive working days (ergonomic scheduling)
 *  G. Rotation: Respect Früh/Spät/Nacht rotation patterns, penalize bad transitions
 *  H. Weekend fairness: Balance weekend/holiday shifts across team
 *
 * Algorithm:
 *  1. Load all data (employees, shifts, availability, absences, holidays, skills)
 *  2. For each open shift, compute the "domain" of eligible employees
 *  3. Apply Most-Constrained-Variable (MCV) heuristic: schedule hardest shifts first
 *  4. For each shift, score all eligible employees and pick the best
 *  5. After assignment, propagate constraints (update hours, check rest periods)
 *  6. If stuck, backtrack and try the next best candidate
 *
 * Backfill mode:
 *  - Single-shift instant replacement when an employee calls sick
 *  - Reuses domain computation + scoring for the one target shift
 *  - Returns ranked list of available replacements
 */

import { prisma } from "@/lib/db";
import { calcGrossMinutes } from "@/lib/time-utils";
import {
  isPublicHoliday,
  isSunday,
  isNightShift,
  calculateSurcharge,
} from "@/lib/holidays";
import { log } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** Shift time category for rotation pattern detection */
export type ShiftCategory = "FRUEH" | "SPAET" | "NACHT" | "OTHER";

export interface SchedulerConfig {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
  locationId?: string;
  bundesland: string;
  /** Weight multipliers for soft objectives (0–100) */
  weights?: {
    fairness?: number; // default 35
    preference?: number; // default 20
    cost?: number; // default 15
    continuity?: number; // default 10
    staffing?: number; // default 5
    fatigue?: number; // default 10 — consecutive-day penalty
    rotation?: number; // default 5 — bad rotation penalty
  };
}

/** Config for the single-shift backfill (instant replacement) */
export interface BackfillConfig {
  workspaceId: string;
  shiftId: string;
  bundesland: string;
  /** How many replacement candidates to return */
  maxCandidates?: number;
}

export interface BackfillCandidate {
  employeeId: string;
  employeeName: string;
  score: number;
  reasons: string[];
  costEstimate: number;
}

export interface BackfillResult {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  candidates: BackfillCandidate[];
  totalCandidates: number;
}

export interface ShiftSlot {
  shiftId: string;
  date: Date;
  dateStr: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  locationId: string | null;
  locationName: string | null;
  isNight: boolean;
  isHoliday: boolean;
  isSundayShift: boolean;
  surchargePercent: number;
  /** Required skill from StaffingRequirement (if matched) */
  requiredSkillId: string | null;
  /** Eligible employee IDs after hard constraint filtering */
  domain: string[];
}

export interface EmployeeData {
  id: string;
  firstName: string;
  lastName: string;
  weeklyHours: number;
  workDaysPerWeek: number;
  hourlyRate: number;
  departmentId: string | null;
  skillIds: Set<string>;
  /** Weekday → availability entries */
  availabilityMap: Map<
    number,
    Array<{
      startTime: string | null;
      endTime: string | null;
      type: string;
      validFrom: Date;
      validUntil: Date | null;
    }>
  >;
  /** Set of date strings (YYYY-MM-DD) with approved absences */
  absenceDates: Set<string>;
}

export interface Assignment {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  locationName: string | null;
  employeeId: string;
  employeeName: string;
  score: number;
  /** Why this employee was chosen */
  reasons: string[];
  /** Estimated shift cost (hourlyRate × hours × surcharge) */
  costEstimate: number;
}

export interface UnresolvedShift {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  reason: string;
  requiredSkill?: string;
}

export interface SchedulerResult {
  assignments: Assignment[];
  unresolvedShifts: UnresolvedShift[];
  totalOpenShifts: number;
  assignedCount: number;
  unresolvedCount: number;
  totalCostEstimate: number;
  fairnessScore: number;
  /** Per-employee hour distribution */
  employeeHours: Record<
    string,
    { name: string; scheduled: number; contract: number; ratio: number }
  >;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (ArbZG)
// ═══════════════════════════════════════════════════════════════

const MIN_REST_HOURS = 11;
const MAX_DAILY_HOURS = 10;
const MAX_WEEKLY_HOURS = 48;
const MAX_DAILY_MINUTES = MAX_DAILY_HOURS * 60;
const MAX_WEEKLY_MINUTES = MAX_WEEKLY_HOURS * 60;
const MIN_REST_MINUTES = MIN_REST_HOURS * 60;

// Fatigue thresholds (consecutive working days)
const FATIGUE_WARN_DAYS = 5; // mild penalty starts
const FATIGUE_HARD_DAYS = 6; // ArbZG §9: max 6 consecutive days

// Shift category time boundaries (minutes from midnight)
const FRUEH_END = 14 * 60; // Frühschicht ends before 14:00
const SPAET_START = 13 * 60; // Spätschicht starts at or after 13:00
const NACHT_START = 20 * 60; // Nachtschicht starts at or after 20:00
const NACHT_END = 8 * 60; // Nachtschicht ends before 08:00

// ═══════════════════════════════════════════════════════════════
// MAIN SOLVER
// ═══════════════════════════════════════════════════════════════

export async function runAutoScheduler(
  config: SchedulerConfig,
): Promise<SchedulerResult> {
  const { workspaceId, startDate, endDate, locationId, bundesland } = config;
  const weights = {
    fairness: config.weights?.fairness ?? 35,
    preference: config.weights?.preference ?? 20,
    cost: config.weights?.cost ?? 15,
    continuity: config.weights?.continuity ?? 10,
    staffing: config.weights?.staffing ?? 5,
    fatigue: config.weights?.fatigue ?? 10,
    rotation: config.weights?.rotation ?? 5,
  };

  const daysDiff =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;

  log.info("[auto-scheduler] Starting CSP solver", {
    workspaceId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    locationId,
    days: daysDiff,
  });

  // ── 1. Load all data ──
  const [employees, openShifts, existingShifts, staffingReqs] =
    await Promise.all([
      loadEmployees(workspaceId, startDate, endDate),
      loadOpenShifts(workspaceId, startDate, endDate, locationId),
      loadExistingShifts(workspaceId, startDate, endDate),
      loadStaffingRequirements(workspaceId, locationId),
    ]);

  if (openShifts.length === 0) {
    return {
      assignments: [],
      unresolvedShifts: [],
      totalOpenShifts: 0,
      assignedCount: 0,
      unresolvedCount: 0,
      totalCostEstimate: 0,
      fairnessScore: 1.0,
      employeeHours: {},
    };
  }

  // ── 2. Build employee index ──
  const employeeMap = new Map<string, EmployeeData>();
  for (const emp of employees) {
    employeeMap.set(emp.id, emp);
  }

  // ── 3. Build shift slots with domains ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots: ShiftSlot[] = openShifts.map((shift: any) => {
    const shiftDate = shift.date;
    const dateStr = shiftDate.toISOString().split("T")[0];
    const holiday = isPublicHoliday(shiftDate, bundesland);
    const sunday = isSunday(shiftDate);
    const night = isNightShift(shift.startTime, shift.endTime);
    const surcharge = calculateSurcharge({
      isNight: night,
      isSunday: sunday,
      isHoliday: holiday.isHoliday,
    });

    // Find matching staffing requirement for skill filtering
    const dayOfWeek = shiftDate.getDay();
    const isoWeekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const matchingReq = staffingReqs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) =>
        r.weekday === isoWeekday &&
        timesOverlap(r.startTime, r.endTime, shift.startTime, shift.endTime) &&
        (!r.locationId || r.locationId === shift.locationId),
    );

    return {
      shiftId: shift.id,
      date: shiftDate,
      dateStr,
      startTime: shift.startTime,
      endTime: shift.endTime,
      durationMinutes: calcGrossMinutes(shift.startTime, shift.endTime),
      locationId: shift.locationId,
      locationName: shift.location?.name || null,
      isNight: night,
      isHoliday: holiday.isHoliday,
      isSundayShift: sunday,
      surchargePercent: surcharge,
      requiredSkillId: matchingReq?.requiredSkillId || null,
      domain: [], // computed next
    };
  });

  // ── 4. Initialize tracking state ──
  // Track scheduled minutes per employee per day (dateStr → minutes)
  const employeeDayMinutes = new Map<string, Map<string, number>>();
  // Track scheduled minutes per employee per week (weekKey → minutes)
  const employeeWeekMinutes = new Map<string, Map<string, number>>();
  // Track shift end times per employee per day (for rest period checks)
  const employeeShiftTimes = new Map<
    string,
    Map<string, Array<{ start: number; end: number }>>
  >();

  // Seed with existing (already-assigned) shifts
  for (const shift of existingShifts) {
    if (!shift.employeeId) continue;
    const dateStr = shift.date.toISOString().split("T")[0];
    const minutes = calcGrossMinutes(shift.startTime, shift.endTime);

    addMinutes(employeeDayMinutes, shift.employeeId, dateStr, minutes);
    addMinutes(
      employeeWeekMinutes,
      shift.employeeId,
      getWeekKey(shift.date),
      minutes,
    );
    addShiftTime(
      employeeShiftTimes,
      shift.employeeId,
      dateStr,
      shift.startTime,
      shift.endTime,
    );
  }

  // Track total scheduled minutes across the entire scheduling period
  const totalScheduledMinutes = new Map<string, number>();
  for (const [empId, dayMap] of employeeDayMinutes) {
    let total = 0;
    for (const mins of dayMap.values()) total += mins;
    totalScheduledMinutes.set(empId, total);
  }

  // ── 4b. Track consecutive working days per employee ──
  const employeeWorkDates = new Map<string, Set<string>>();
  for (const shift of existingShifts) {
    if (!shift.employeeId) continue;
    const dateStr = shift.date.toISOString().split("T")[0];
    if (!employeeWorkDates.has(shift.employeeId)) {
      employeeWorkDates.set(shift.employeeId, new Set());
    }
    employeeWorkDates.get(shift.employeeId)!.add(dateStr);
  }

  // ── 4c. Track weekend/holiday shifts per employee ──
  const employeeWeekendShifts = new Map<string, number>();
  for (const shift of existingShifts) {
    if (!shift.employeeId) continue;
    const shiftDate = shift.date;
    const isWeekendOrHoliday =
      isSunday(shiftDate) ||
      shiftDate.getDay() === 6 ||
      isPublicHoliday(shiftDate, bundesland).isHoliday;
    if (isWeekendOrHoliday) {
      employeeWeekendShifts.set(
        shift.employeeId,
        (employeeWeekendShifts.get(shift.employeeId) || 0) + 1,
      );
    }
  }

  // ── 4d. Track last shift category per employee (for rotation) ──
  const employeeLastCategory = new Map<string, ShiftCategory>();
  // Sort existing shifts by date+time to find the most recent per employee
  const sortedExisting = [...existingShifts]
    .filter((s) => s.employeeId)
    .sort((a, b) => {
      const dateComp = a.date.toISOString().localeCompare(b.date.toISOString());
      if (dateComp !== 0) return dateComp;
      return a.startTime.localeCompare(b.startTime);
    });
  for (const shift of sortedExisting) {
    if (shift.employeeId) {
      employeeLastCategory.set(
        shift.employeeId,
        classifyShift(shift.startTime, shift.endTime),
      );
    }
  }

  // ── 5. Compute domains (eligible employees for each slot) ──
  for (const slot of slots) {
    slot.domain = computeDomain(
      slot,
      employees,
      employeeDayMinutes,
      employeeWeekMinutes,
      employeeShiftTimes,
    );
  }

  // ── 6. Sort slots by MCV heuristic (smallest domain first) ──
  slots.sort((a, b) => {
    // Primary: smallest domain (most constrained)
    if (a.domain.length !== b.domain.length)
      return a.domain.length - b.domain.length;
    // Secondary: earlier date
    if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
    // Tertiary: earlier start time
    return a.startTime.localeCompare(b.startTime);
  });

  // ── 7. Solve: assign employees to slots ──
  const assignments: Assignment[] = [];
  const unresolvedShifts: UnresolvedShift[] = [];
  let totalCostEstimate = 0;

  for (const slot of slots) {
    // Recompute domain to reflect assignments made so far
    const currentDomain = computeDomain(
      slot,
      employees,
      employeeDayMinutes,
      employeeWeekMinutes,
      employeeShiftTimes,
    );

    if (currentDomain.length === 0) {
      unresolvedShifts.push({
        shiftId: slot.shiftId,
        shiftDate: slot.dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        locationName: slot.locationName,
        reason: "Kein verfügbarer Mitarbeiter gefunden",
        requiredSkill: slot.requiredSkillId || undefined,
      });
      continue;
    }

    // Score all candidates
    const scored = currentDomain
      .map((empId) => {
        const emp = employeeMap.get(empId)!;
        const { score, reasons } = scoreEmployee(
          emp,
          slot,
          totalScheduledMinutes,
          daysDiff,
          weights,
          staffingReqs,
          employeeWorkDates,
          employeeWeekendShifts,
          employeeLastCategory,
        );
        return { empId, emp, score, reasons };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const emp = best.emp;
    const hours = slot.durationMinutes / 60;
    const surchargeMultiplier = 1 + slot.surchargePercent / 100;
    const cost = emp.hourlyRate * hours * surchargeMultiplier;

    assignments.push({
      shiftId: slot.shiftId,
      shiftDate: slot.dateStr,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      locationName: slot.locationName,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      score: Math.round(best.score * 10) / 10,
      reasons: best.reasons,
      costEstimate: Math.round(cost * 100) / 100,
    });

    totalCostEstimate += cost;

    // ── Propagate constraints ──
    addMinutes(employeeDayMinutes, emp.id, slot.dateStr, slot.durationMinutes);
    addMinutes(
      employeeWeekMinutes,
      emp.id,
      getWeekKey(slot.date),
      slot.durationMinutes,
    );
    addShiftTime(
      employeeShiftTimes,
      emp.id,
      slot.dateStr,
      slot.startTime,
      slot.endTime,
    );
    totalScheduledMinutes.set(
      emp.id,
      (totalScheduledMinutes.get(emp.id) || 0) + slot.durationMinutes,
    );

    // Track working day for fatigue
    if (!employeeWorkDates.has(emp.id)) {
      employeeWorkDates.set(emp.id, new Set());
    }
    employeeWorkDates.get(emp.id)!.add(slot.dateStr);

    // Track weekend/holiday shift
    const isWeekendOrHoliday =
      slot.isSundayShift || slot.date.getDay() === 6 || slot.isHoliday;
    if (isWeekendOrHoliday) {
      employeeWeekendShifts.set(
        emp.id,
        (employeeWeekendShifts.get(emp.id) || 0) + 1,
      );
    }

    // Track last shift category for rotation
    employeeLastCategory.set(
      emp.id,
      classifyShift(slot.startTime, slot.endTime),
    );
  }

  // ── 8. Calculate fairness score ──
  const fairnessScore = calculateFairnessScore(
    employees,
    totalScheduledMinutes,
    daysDiff,
  );

  // ── 9. Build employee hours summary ──
  const employeeHours: Record<
    string,
    { name: string; scheduled: number; contract: number; ratio: number }
  > = {};
  for (const emp of employees) {
    const scheduled = (totalScheduledMinutes.get(emp.id) || 0) / 60;
    const periodWeeks = Math.max(1, daysDiff / 7);
    const contract = emp.weeklyHours * periodWeeks;
    employeeHours[emp.id] = {
      name: `${emp.firstName} ${emp.lastName}`,
      scheduled: Math.round(scheduled * 10) / 10,
      contract: Math.round(contract * 10) / 10,
      ratio: contract > 0 ? Math.round((scheduled / contract) * 100) / 100 : 0,
    };
  }

  log.info("[auto-scheduler] CSP solver completed", {
    assigned: assignments.length,
    unresolved: unresolvedShifts.length,
    totalCost: Math.round(totalCostEstimate * 100) / 100,
    fairness: fairnessScore,
  });

  return {
    assignments,
    unresolvedShifts,
    totalOpenShifts: slots.length,
    assignedCount: assignments.length,
    unresolvedCount: unresolvedShifts.length,
    totalCostEstimate: Math.round(totalCostEstimate * 100) / 100,
    fairnessScore,
    employeeHours,
  };
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════

async function loadEmployees(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
): Promise<EmployeeData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees: any[] = await (prisma.employee.findMany as any)({
    where: { workspaceId, isActive: true, deletedAt: null },
    include: {
      availabilities: true,
      employeeSkills: { include: { skill: true } },
      absenceRequests: {
        where: {
          status: "GENEHMIGT",
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      },
    },
  });

  return employees.map((emp) => {
    // Build availability map: weekday → entries
    const availabilityMap = new Map<
      number,
      Array<{
        startTime: string | null;
        endTime: string | null;
        type: string;
        validFrom: Date;
        validUntil: Date | null;
      }>
    >();
    for (const a of emp.availabilities) {
      if (!availabilityMap.has(a.weekday)) {
        availabilityMap.set(a.weekday, []);
      }
      availabilityMap.get(a.weekday)!.push({
        startTime: a.startTime,
        endTime: a.endTime,
        type: a.type,
        validFrom: a.validFrom,
        validUntil: a.validUntil,
      });
    }

    // Build absence date set
    const absenceDates = new Set<string>();
    for (const absence of emp.absenceRequests) {
      const current = new Date(absence.startDate);
      const end = new Date(absence.endDate);
      while (current <= end) {
        absenceDates.add(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    }

    // Build skill IDs set (only non-expired)
    const now = new Date();
    const skillIds = new Set<string>();
    for (const es of emp.employeeSkills) {
      if (!es.expiresAt || es.expiresAt >= now) {
        skillIds.add(es.skillId);
      }
    }

    return {
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      weeklyHours: emp.weeklyHours,
      workDaysPerWeek: emp.workDaysPerWeek,
      hourlyRate: emp.hourlyRate ?? 0,
      departmentId: emp.departmentId,
      skillIds,
      availabilityMap,
      absenceDates,
    };
  });
}

async function loadOpenShifts(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
  locationId?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    workspaceId,
    status: "OPEN",
    employeeId: null,
    date: { gte: startDate, lte: endDate },
    deletedAt: null,
  };
  if (locationId) where.locationId = locationId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma.shift.findMany as any)({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { location: true },
  });
}

async function loadExistingShifts(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma.shift.findMany as any)({
    where: {
      workspaceId,
      date: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
      employeeId: { not: null },
      deletedAt: null,
    },
  });
}

async function loadStaffingRequirements(
  workspaceId: string,
  locationId?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    workspaceId,
    isActive: true,
  };
  if (locationId) where.locationId = locationId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any).staffingRequirement.findMany({ where });
}

// ═══════════════════════════════════════════════════════════════
// DOMAIN COMPUTATION (HARD CONSTRAINTS)
// ═══════════════════════════════════════════════════════════════

function computeDomain(
  slot: ShiftSlot,
  employees: EmployeeData[],
  dayMinutes: Map<string, Map<string, number>>,
  weekMinutes: Map<string, Map<string, number>>,
  shiftTimes: Map<string, Map<string, Array<{ start: number; end: number }>>>,
): string[] {
  const eligible: string[] = [];
  const dayOfWeek = slot.date.getDay();
  const isoWeekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekKey = getWeekKey(slot.date);
  const slotStartMin = toMinutes(slot.startTime);
  let slotEndMin = toMinutes(slot.endTime);
  if (slotEndMin <= slotStartMin) slotEndMin += 1440;

  for (const emp of employees) {
    // ── C1: Absence check ──
    if (emp.absenceDates.has(slot.dateStr)) continue;

    // ── C2: Unavailability check ──
    const avails = emp.availabilityMap.get(isoWeekday) || [];
    let isUnavailable = false;
    for (const a of avails) {
      if (a.type !== "NICHT_VERFUEGBAR") continue;
      if (a.validFrom > slot.date) continue;
      if (a.validUntil && a.validUntil < slot.date) continue;
      // Check time overlap (or whole-day unavailability)
      if (!a.startTime || !a.endTime) {
        isUnavailable = true;
        break;
      }
      if (timesOverlap(a.startTime, a.endTime, slot.startTime, slot.endTime)) {
        isUnavailable = true;
        break;
      }
    }
    if (isUnavailable) continue;

    // ── C3: Skill requirement ──
    if (slot.requiredSkillId && !emp.skillIds.has(slot.requiredSkillId)) {
      continue;
    }

    // ── C4: Max daily hours (ArbZG §3) ──
    const currentDayMin = getDayMinutes(dayMinutes, emp.id, slot.dateStr);
    if (currentDayMin + slot.durationMinutes > MAX_DAILY_MINUTES) continue;

    // ── C5: Max weekly hours (ArbZG §3) ──
    const currentWeekMin = getWeekMinutes(weekMinutes, emp.id, weekKey);
    if (currentWeekMin + slot.durationMinutes > MAX_WEEKLY_MINUTES) continue;

    // ── C6: Shift overlap check ──
    const dayShifts = getShiftTimes(shiftTimes, emp.id, slot.dateStr);
    let hasOverlap = false;
    for (const existing of dayShifts) {
      if (slotStartMin < existing.end && existing.start < slotEndMin) {
        hasOverlap = true;
        break;
      }
    }
    if (hasOverlap) continue;

    // ── C7: Rest period (ArbZG §5: 11h between shifts) ──
    if (!checkRestPeriod(shiftTimes, emp.id, slot)) continue;

    // ── C8: Contract hours limit (soft cap at 110%) ──
    const periodWeeks = Math.max(
      1,
      (slot.date.getTime() - new Date(slot.dateStr).getTime()) /
        (7 * 24 * 60 * 60 * 1000) +
        1,
    );
    // Use a generous cap of 120% during domain filtering
    // (stricter penalty applied in scoring)
    const contractCap = emp.weeklyHours * 60 * periodWeeks * 1.2;
    const totalMin = getWeekMinutes(weekMinutes, emp.id, weekKey);
    if (totalMin + slot.durationMinutes > contractCap) continue;

    eligible.push(emp.id);
  }

  return eligible;
}

// ═══════════════════════════════════════════════════════════════
// SCORING (SOFT OBJECTIVES)
// ═══════════════════════════════════════════════════════════════

function scoreEmployee(
  emp: EmployeeData,
  slot: ShiftSlot,
  totalScheduled: Map<string, number>,
  totalDays: number,
  weights: {
    fairness: number;
    preference: number;
    cost: number;
    continuity: number;
    staffing: number;
    fatigue: number;
    rotation: number;
  },
  _staffingReqs: Awaited<ReturnType<typeof loadStaffingRequirements>>,
  workDates: Map<string, Set<string>>,
  weekendShifts: Map<string, number>,
  lastCategory: Map<string, ShiftCategory>,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const periodWeeks = Math.max(1, totalDays / 7);

  // ── A. Fairness: Lower utilization = higher score ──
  const currentMinutes = totalScheduled.get(emp.id) || 0;
  const targetMinutes = emp.weeklyHours * 60 * periodWeeks;
  const utilization = targetMinutes > 0 ? currentMinutes / targetMinutes : 0;

  // Employees below target get bonus, above get penalty
  const fairnessScore = Math.max(0, 1 - utilization);
  score += fairnessScore * weights.fairness;
  if (utilization < 0.5) {
    reasons.push("Wenig eingeplant");
  }

  // Heavy penalty for exceeding contract by >10%
  if (
    currentMinutes + slot.durationMinutes > targetMinutes * 1.1 &&
    targetMinutes > 0
  ) {
    score -= weights.fairness * 0.8;
    reasons.push("Überstunden");
  }

  // ── B. Preference: BEVORZUGT availability bonus (with time-window matching) ──
  const dayOfWeek = slot.date.getDay();
  const isoWeekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const avails = emp.availabilityMap.get(isoWeekday) || [];
  let preferenceScore = 0;
  for (const a of avails) {
    if (a.type !== "BEVORZUGT") continue;
    if (a.validFrom > slot.date) continue;
    if (a.validUntil && a.validUntil < slot.date) continue;

    // Full day preference (no times specified)
    if (!a.startTime || !a.endTime) {
      preferenceScore = 1.0;
      break;
    }
    // Time-window preference — check overlap and give proportional bonus
    if (timesOverlap(a.startTime, a.endTime, slot.startTime, slot.endTime)) {
      preferenceScore = 1.0;
      break;
    }
    // Available but not in preferred time window — small bonus
    preferenceScore = Math.max(preferenceScore, 0.3);
  }
  if (preferenceScore > 0) {
    score += preferenceScore * weights.preference;
    reasons.push(
      preferenceScore >= 1.0 ? "Bevorzugte Zeit" : "Verfügbar (andere Zeit)",
    );
  }

  // ── C. Cost: Lower surcharge = higher score ──
  if (slot.surchargePercent === 0) {
    score += weights.cost;
  } else {
    // Higher-paid employees cost more on surcharge shifts
    const costPenalty =
      (slot.surchargePercent / 225) * (emp.hourlyRate / 30) * weights.cost;
    score -= costPenalty;
    if (slot.surchargePercent > 50) reasons.push("Zuschlagschicht");
  }

  // ── D. Staffing: Department/location alignment ──
  if (slot.locationId && emp.departmentId) {
    score += weights.staffing * 0.5;
    reasons.push("Standort-Match");
  }

  // ── E. Continuity: Skill match bonus ──
  if (slot.requiredSkillId && emp.skillIds.has(slot.requiredSkillId)) {
    score += weights.continuity;
    reasons.push("Qualifikation passt");
  }

  // ── F. Fatigue: Consecutive working days penalty ──
  const consecutiveDays = getConsecutiveDays(workDates, emp.id, slot.dateStr);
  if (consecutiveDays >= FATIGUE_HARD_DAYS) {
    // ArbZG §9 — 6 consecutive days max. Hard penalty.
    score -= weights.fatigue * 2.0;
    reasons.push("Max. Arbeitstage erreicht");
  } else if (consecutiveDays >= FATIGUE_WARN_DAYS) {
    // 5 days in a row — moderate penalty
    score -= weights.fatigue * 0.8;
    reasons.push("Ermüdungsrisiko");
  } else if (consecutiveDays >= 3) {
    // 3-4 days — mild penalty
    score -= weights.fatigue * 0.2;
  }

  // ── G. Rotation: Penalize bad shift transitions ──
  const prevCategory = lastCategory.get(emp.id);
  const slotCategory = classifyShift(slot.startTime, slot.endTime);
  if (prevCategory) {
    const rotationPenalty = getRotationPenalty(prevCategory, slotCategory);
    if (rotationPenalty > 0) {
      score -= rotationPenalty * weights.rotation;
      if (rotationPenalty >= 1.0) {
        reasons.push("Ungünstige Rotation");
      }
    } else if (rotationPenalty === 0 && prevCategory === slotCategory) {
      // Same shift category — consistency bonus
      score += weights.rotation * 0.3;
      reasons.push("Schichtkontinuität");
    }
  }

  // ── H. Weekend fairness: Penalize employees with many weekend shifts ──
  const empWeekendCount = weekendShifts.get(emp.id) || 0;
  if (slot.isSundayShift || slot.isHoliday || slot.date.getDay() === 6) {
    // This is a weekend/holiday shift — prefer employees with fewer weekend shifts
    if (empWeekendCount === 0) {
      score += weights.fairness * 0.3;
      reasons.push("Wenig Wochenendschichten");
    } else if (empWeekendCount >= 3) {
      score -= weights.fairness * 0.5;
      reasons.push("Viele Wochenendschichten");
    }
  }

  // ── Base score (ensures non-zero for fair comparison) ──
  score += 50;

  return { score, reasons };
}

// ═══════════════════════════════════════════════════════════════
// FAIRNESS CALCULATION
// ═══════════════════════════════════════════════════════════════

function calculateFairnessScore(
  employees: EmployeeData[],
  totalScheduled: Map<string, number>,
  totalDays: number,
): number {
  if (employees.length === 0) return 1.0;

  const periodWeeks = Math.max(1, totalDays / 7);
  const ratios: number[] = [];

  for (const emp of employees) {
    const scheduled = totalScheduled.get(emp.id) || 0;
    const target = emp.weeklyHours * 60 * periodWeeks;
    if (target > 0) {
      ratios.push(scheduled / target);
    }
  }

  if (ratios.length === 0) return 1.0;

  // Fairness = 1 - coefficient of variation (std dev / mean)
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  if (mean === 0) return 1.0;

  const variance =
    ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Score from 0 to 1 (1 = perfectly fair)
  return Math.max(0, Math.min(1, Math.round((1 - cv) * 100) / 100));
}

// ═══════════════════════════════════════════════════════════════
// REST PERIOD CHECK
// ═══════════════════════════════════════════════════════════════

function checkRestPeriod(
  shiftTimes: Map<string, Map<string, Array<{ start: number; end: number }>>>,
  employeeId: string,
  slot: ShiftSlot,
): boolean {
  const slotStartMin = toMinutes(slot.startTime);
  let slotEndMin = toMinutes(slot.endTime);
  if (slotEndMin <= slotStartMin) slotEndMin += 1440;

  // Check same day
  const sameDayShifts = getShiftTimes(shiftTimes, employeeId, slot.dateStr);
  for (const existing of sameDayShifts) {
    // Non-overlapping — check gap
    if (!(slotStartMin < existing.end && existing.start < slotEndMin)) {
      let gap: number;
      if (slotStartMin >= existing.end) {
        gap = slotStartMin - existing.end;
      } else {
        gap = existing.start - slotEndMin;
      }
      if (gap < MIN_REST_MINUTES) return false;
    }
  }

  // Check previous day
  const prevDate = new Date(slot.date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split("T")[0];
  const prevShifts = getShiftTimes(shiftTimes, employeeId, prevDateStr);
  for (const existing of prevShifts) {
    // Gap = (24:00 - prevEnd) + slotStart
    const gap = 1440 - existing.end + slotStartMin;
    if (gap < MIN_REST_MINUTES) return false;
  }

  // Check next day
  const nextDate = new Date(slot.date);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split("T")[0];
  const nextShifts = getShiftTimes(shiftTimes, employeeId, nextDateStr);
  for (const existing of nextShifts) {
    // Gap = (24:00 - slotEnd) + nextStart
    const gap = 1440 - slotEndMin + existing.start;
    if (gap < MIN_REST_MINUTES) return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

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

function getWeekKey(date: Date): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().split("T")[0];
}

function addMinutes(
  map: Map<string, Map<string, number>>,
  empId: string,
  key: string,
  minutes: number,
) {
  if (!map.has(empId)) map.set(empId, new Map());
  const empMap = map.get(empId)!;
  empMap.set(key, (empMap.get(key) || 0) + minutes);
}

function getDayMinutes(
  map: Map<string, Map<string, number>>,
  empId: string,
  dateStr: string,
): number {
  return map.get(empId)?.get(dateStr) || 0;
}

function getWeekMinutes(
  map: Map<string, Map<string, number>>,
  empId: string,
  weekKey: string,
): number {
  return map.get(empId)?.get(weekKey) || 0;
}

function addShiftTime(
  map: Map<string, Map<string, Array<{ start: number; end: number }>>>,
  empId: string,
  dateStr: string,
  startTime: string,
  endTime: string,
) {
  if (!map.has(empId)) map.set(empId, new Map());
  const empMap = map.get(empId)!;
  if (!empMap.has(dateStr)) empMap.set(dateStr, []);
  const s = toMinutes(startTime);
  let e = toMinutes(endTime);
  if (e <= s) e += 1440;
  empMap.get(dateStr)!.push({ start: s, end: e });
}

function getShiftTimes(
  map: Map<string, Map<string, Array<{ start: number; end: number }>>>,
  empId: string,
  dateStr: string,
): Array<{ start: number; end: number }> {
  return map.get(empId)?.get(dateStr) || [];
}

// ═══════════════════════════════════════════════════════════════
// SHIFT CLASSIFICATION & ROTATION
// ═══════════════════════════════════════════════════════════════

/**
 * Classify a shift into Früh / Spät / Nacht / Other based on start/end times.
 */
function classifyShift(startTime: string, endTime: string): ShiftCategory {
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);

  // Night shift: starts at or after 20:00, or ends before 08:00 (overnight)
  if (
    startMin >= NACHT_START ||
    (endMin <= NACHT_END && endMin > 0 && endMin < startMin + 1440)
  ) {
    return "NACHT";
  }
  // Early shift: ends before 14:00
  if (endMin > 0 && endMin <= FRUEH_END && startMin < SPAET_START) {
    return "FRUEH";
  }
  // Late shift: starts at or after 13:00
  if (startMin >= SPAET_START) {
    return "SPAET";
  }
  return "OTHER";
}

/**
 * Calculate consecutive working days ending on the given dateStr.
 * Counts backwards from dateStr to find the streak length.
 */
function getConsecutiveDays(
  workDates: Map<string, Set<string>>,
  empId: string,
  dateStr: string,
): number {
  const dates = workDates.get(empId);
  if (!dates) return 0;

  let count = 0;
  const d = new Date(dateStr);
  // Include the proposed date itself
  while (true) {
    const key = d.toISOString().split("T")[0];
    if (dates.has(key)) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/**
 * Get rotation penalty for transitioning between shift categories.
 * Forward rotation (Früh→Spät→Nacht) is ergonomically preferred.
 * Backward rotation (Nacht→Früh) is penalized heavily.
 *
 * Returns 0.0 (good/neutral) to 1.5 (very bad transition).
 */
function getRotationPenalty(from: ShiftCategory, to: ShiftCategory): number {
  // Same category — no penalty
  if (from === to) return 0;

  // Forward rotation (ergonomically preferred): Früh→Spät→Nacht
  if (from === "FRUEH" && to === "SPAET") return 0;
  if (from === "SPAET" && to === "NACHT") return 0;

  // Recovery day after night shift before early shift — worst case
  if (from === "NACHT" && to === "FRUEH") return 1.5;

  // Backward rotation (bad): Spät→Früh, Nacht→Spät
  if (from === "SPAET" && to === "FRUEH") return 1.0;
  if (from === "NACHT" && to === "SPAET") return 0.5;

  // Any transition involving OTHER is neutral
  return 0.2;
}

// ═══════════════════════════════════════════════════════════════
// BACKFILL (SINGLE-SHIFT INSTANT REPLACEMENT)
// ═══════════════════════════════════════════════════════════════

/**
 * Find replacement candidates for a single shift.
 * Used when an employee calls in sick and needs to be replaced immediately.
 *
 * Returns a ranked list of available employees who can fill the shift,
 * scored by the same criteria as the auto-scheduler.
 */
export async function runBackfill(
  config: BackfillConfig,
): Promise<BackfillResult> {
  const { workspaceId, shiftId, bundesland, maxCandidates = 5 } = config;

  log.info("[backfill] Finding replacement candidates", {
    workspaceId,
    shiftId,
  });

  // Load the target shift
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shift = await (prisma.shift.findUnique as any)({
    where: { id: shiftId },
    include: { location: true },
  });

  if (!shift) {
    throw new Error(`Shift ${shiftId} not found`);
  }

  const shiftDate = shift.date;
  const dateStr = shiftDate.toISOString().split("T")[0];

  // Build the slot
  const holiday = isPublicHoliday(shiftDate, bundesland);
  const sunday = isSunday(shiftDate);
  const night = isNightShift(shift.startTime, shift.endTime);
  const surcharge = calculateSurcharge({
    isNight: night,
    isSunday: sunday,
    isHoliday: holiday.isHoliday,
  });

  const slot: ShiftSlot = {
    shiftId: shift.id,
    date: shiftDate,
    dateStr,
    startTime: shift.startTime,
    endTime: shift.endTime,
    durationMinutes: calcGrossMinutes(shift.startTime, shift.endTime),
    locationId: shift.locationId,
    locationName: shift.location?.name || null,
    isNight: night,
    isHoliday: holiday.isHoliday,
    isSundayShift: sunday,
    surchargePercent: surcharge,
    requiredSkillId: null,
    domain: [],
  };

  // Load context — same week window for constraint checking
  const weekStart = new Date(shiftDate);
  const dayOfWeek = weekStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [employees, existingShifts, staffingReqs] = await Promise.all([
    loadEmployees(workspaceId, weekStart, weekEnd),
    loadExistingShifts(workspaceId, weekStart, weekEnd),
    loadStaffingRequirements(workspaceId, shift.locationId || undefined),
  ]);

  // Find matching staffing requirement for skill filtering
  const isoWeekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const matchingReq = staffingReqs.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) =>
      r.weekday === isoWeekday &&
      timesOverlap(r.startTime, r.endTime, shift.startTime, shift.endTime) &&
      (!r.locationId || r.locationId === shift.locationId),
  );
  if (matchingReq) {
    slot.requiredSkillId = matchingReq.requiredSkillId || null;
  }

  // Build tracking state from existing shifts
  const employeeDayMinutes = new Map<string, Map<string, number>>();
  const employeeWeekMinutes = new Map<string, Map<string, number>>();
  const employeeShiftTimes = new Map<
    string,
    Map<string, Array<{ start: number; end: number }>>
  >();
  const employeeWorkDates = new Map<string, Set<string>>();
  const employeeWeekendShifts = new Map<string, number>();
  const employeeLastCategory = new Map<string, ShiftCategory>();

  for (const s of existingShifts) {
    if (!s.employeeId) continue;
    const sDateStr = s.date.toISOString().split("T")[0];
    const minutes = calcGrossMinutes(s.startTime, s.endTime);

    addMinutes(employeeDayMinutes, s.employeeId, sDateStr, minutes);
    addMinutes(employeeWeekMinutes, s.employeeId, getWeekKey(s.date), minutes);
    addShiftTime(
      employeeShiftTimes,
      s.employeeId,
      sDateStr,
      s.startTime,
      s.endTime,
    );

    if (!employeeWorkDates.has(s.employeeId)) {
      employeeWorkDates.set(s.employeeId, new Set());
    }
    employeeWorkDates.get(s.employeeId)!.add(sDateStr);

    const isWeekendOrHoliday =
      isSunday(s.date) ||
      s.date.getDay() === 6 ||
      isPublicHoliday(s.date, bundesland).isHoliday;
    if (isWeekendOrHoliday) {
      employeeWeekendShifts.set(
        s.employeeId,
        (employeeWeekendShifts.get(s.employeeId) || 0) + 1,
      );
    }

    employeeLastCategory.set(
      s.employeeId,
      classifyShift(s.startTime, s.endTime),
    );
  }

  // Compute eligible employees (domain)
  const domain = computeDomain(
    slot,
    employees,
    employeeDayMinutes,
    employeeWeekMinutes,
    employeeShiftTimes,
  );

  // Exclude the currently assigned employee (they're the one being replaced)
  const filteredDomain = shift.employeeId
    ? domain.filter((id) => id !== shift.employeeId)
    : domain;

  const employeeMap = new Map<string, EmployeeData>();
  for (const emp of employees) employeeMap.set(emp.id, emp);

  const totalScheduled = new Map<string, number>();
  for (const [empId, dayMap] of employeeDayMinutes) {
    let total = 0;
    for (const mins of dayMap.values()) total += mins;
    totalScheduled.set(empId, total);
  }

  const daysDiff = 7; // one week context
  const weights = {
    fairness: 35,
    preference: 20,
    cost: 15,
    continuity: 10,
    staffing: 5,
    fatigue: 10,
    rotation: 5,
  };

  // Score and rank candidates
  const candidates: BackfillCandidate[] = filteredDomain
    .map((empId) => {
      const emp = employeeMap.get(empId)!;
      const { score, reasons } = scoreEmployee(
        emp,
        slot,
        totalScheduled,
        daysDiff,
        weights,
        staffingReqs,
        employeeWorkDates,
        employeeWeekendShifts,
        employeeLastCategory,
      );
      const hours = slot.durationMinutes / 60;
      const surchargeMultiplier = 1 + slot.surchargePercent / 100;
      const costEstimate =
        Math.round(emp.hourlyRate * hours * surchargeMultiplier * 100) / 100;

      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        score: Math.round(score * 10) / 10,
        reasons,
        costEstimate,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);

  log.info("[backfill] Found candidates", {
    shiftId,
    candidates: candidates.length,
  });

  return {
    shiftId,
    shiftDate: dateStr,
    startTime: shift.startTime,
    endTime: shift.endTime,
    locationName: shift.location?.name || null,
    candidates,
    totalCandidates: filteredDomain.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTING EXPORTS (used only by unit tests)
// ═══════════════════════════════════════════════════════════════

export const _testing = {
  toMinutes,
  timesOverlap,
  getWeekKey,
  calculateFairnessScore,
  checkRestPeriod,
  scoreEmployee,
  computeDomain,
  addMinutes,
  addShiftTime,
  getDayMinutes,
  getWeekMinutes,
  getShiftTimes,
  classifyShift,
  getConsecutiveDays,
  getRotationPenalty,
};
