import { describe, it, expect } from "vitest";
import {
  _testing,
  type EmployeeData,
  type ShiftSlot,
  type ShiftCategory,
} from "@/lib/auto-scheduler";

const {
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
} = _testing;

// ═══════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════

function buildEmployee(overrides: Partial<EmployeeData> = {}): EmployeeData {
  return {
    id: "emp-1",
    firstName: "Max",
    lastName: "Mustermann",
    weeklyHours: 40,
    workDaysPerWeek: 5,
    hourlyRate: 15,
    departmentId: null,
    skillIds: new Set<string>(),
    availabilityMap: new Map(),
    absenceDates: new Set<string>(),
    ...overrides,
  };
}

function buildSlot(overrides: Partial<ShiftSlot> = {}): ShiftSlot {
  return {
    shiftId: "shift-1",
    date: new Date("2025-01-06"), // Monday
    dateStr: "2025-01-06",
    startTime: "08:00",
    endTime: "16:00",
    durationMinutes: 480,
    locationId: null,
    locationName: null,
    isNight: false,
    isHoliday: false,
    isSundayShift: false,
    surchargePercent: 0,
    requiredSkillId: null,
    domain: [],
    ...overrides,
  };
}

const DEFAULT_WEIGHTS = {
  fairness: 35,
  preference: 20,
  cost: 15,
  continuity: 10,
  staffing: 5,
  fatigue: 10,
  rotation: 5,
};

// Default empty state for new scoreEmployee parameters
const EMPTY_WORK_DATES = new Map<string, Set<string>>();
const EMPTY_WEEKEND_SHIFTS = new Map<string, number>();
const EMPTY_LAST_CATEGORY = new Map<string, ShiftCategory>();

// ═══════════════════════════════════════════════════════════════
// toMinutes
// ═══════════════════════════════════════════════════════════════

describe("toMinutes", () => {
  it("converts HH:mm to minutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("08:00")).toBe(480);
    expect(toMinutes("12:30")).toBe(750);
    expect(toMinutes("23:59")).toBe(1439);
  });
});

// ═══════════════════════════════════════════════════════════════
// timesOverlap
// ═══════════════════════════════════════════════════════════════

describe("timesOverlap", () => {
  it("detects overlapping times", () => {
    expect(timesOverlap("08:00", "16:00", "12:00", "20:00")).toBe(true);
    expect(timesOverlap("08:00", "16:00", "10:00", "14:00")).toBe(true);
  });

  it("returns false for non-overlapping times", () => {
    expect(timesOverlap("08:00", "12:00", "12:00", "16:00")).toBe(false);
    expect(timesOverlap("08:00", "12:00", "14:00", "18:00")).toBe(false);
  });

  it("handles overnight shifts", () => {
    // 22:00-06:00 (1320-1800) vs 00:00-08:00 (0-480)
    // These don't overlap as ranges because overnight is extended past 1440
    // This is correct — the solver uses per-day tracking for cross-day conflicts
    expect(timesOverlap("22:00", "06:00", "00:00", "08:00")).toBe(false);
    // 22:00-06:00 vs 23:00-07:00 — both overnight, they overlap
    expect(timesOverlap("22:00", "06:00", "23:00", "07:00")).toBe(true);
    // 22:00-06:00 should not overlap with 08:00-16:00
    expect(timesOverlap("22:00", "06:00", "08:00", "16:00")).toBe(false);
  });

  it("handles adjacent shifts (not overlapping)", () => {
    expect(timesOverlap("08:00", "16:00", "16:00", "20:00")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// getWeekKey
// ═══════════════════════════════════════════════════════════════

describe("getWeekKey", () => {
  it("returns Monday date for a Monday", () => {
    expect(getWeekKey(new Date("2025-01-06"))).toBe("2025-01-06"); // Monday
  });

  it("returns Monday date for a Wednesday", () => {
    expect(getWeekKey(new Date("2025-01-08"))).toBe("2025-01-06");
  });

  it("returns Monday date for a Sunday", () => {
    expect(getWeekKey(new Date("2025-01-12"))).toBe("2025-01-06");
  });

  it("returns correct Monday for Saturday", () => {
    expect(getWeekKey(new Date("2025-01-11"))).toBe("2025-01-06");
  });
});

// ═══════════════════════════════════════════════════════════════
// Map helpers
// ═══════════════════════════════════════════════════════════════

describe("map utility helpers", () => {
  it("addMinutes and getDayMinutes track per-employee per-day", () => {
    const map = new Map<string, Map<string, number>>();
    addMinutes(map, "emp-1", "2025-01-06", 480);
    addMinutes(map, "emp-1", "2025-01-06", 120);
    expect(getDayMinutes(map, "emp-1", "2025-01-06")).toBe(600);
    expect(getDayMinutes(map, "emp-1", "2025-01-07")).toBe(0);
    expect(getDayMinutes(map, "emp-2", "2025-01-06")).toBe(0);
  });

  it("getWeekMinutes returns 0 for unknown employee", () => {
    const map = new Map<string, Map<string, number>>();
    expect(getWeekMinutes(map, "unknown", "2025-01-06")).toBe(0);
  });

  it("addShiftTime and getShiftTimes track shift intervals", () => {
    const map = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    addShiftTime(map, "emp-1", "2025-01-06", "08:00", "16:00");
    const shifts = getShiftTimes(map, "emp-1", "2025-01-06");
    expect(shifts).toHaveLength(1);
    expect(shifts[0]).toEqual({ start: 480, end: 960 });
    expect(getShiftTimes(map, "emp-1", "2025-01-07")).toEqual([]);
  });

  it("addShiftTime handles overnight shifts", () => {
    const map = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    addShiftTime(map, "emp-1", "2025-01-06", "22:00", "06:00");
    const shifts = getShiftTimes(map, "emp-1", "2025-01-06");
    expect(shifts[0]).toEqual({ start: 1320, end: 1800 }); // 22*60=1320, 6*60+1440=1800
  });
});

// ═══════════════════════════════════════════════════════════════
// calculateFairnessScore
// ═══════════════════════════════════════════════════════════════

describe("calculateFairnessScore", () => {
  it("returns 1.0 for empty employee list", () => {
    expect(calculateFairnessScore([], new Map(), 7)).toBe(1.0);
  });

  it("returns 1.0 when all employees have 0 hours", () => {
    const employees = [buildEmployee({ id: "a" }), buildEmployee({ id: "b" })];
    expect(calculateFairnessScore(employees, new Map(), 7)).toBe(1.0);
  });

  it("returns 1.0 when all employees are equally scheduled", () => {
    const employees = [
      buildEmployee({ id: "a", weeklyHours: 40 }),
      buildEmployee({ id: "b", weeklyHours: 40 }),
    ];
    const scheduled = new Map([
      ["a", 2400], // 40h in minutes
      ["b", 2400],
    ]);
    expect(calculateFairnessScore(employees, scheduled, 7)).toBe(1.0);
  });

  it("returns lower score for unequal distribution", () => {
    const employees = [
      buildEmployee({ id: "a", weeklyHours: 40 }),
      buildEmployee({ id: "b", weeklyHours: 40 }),
    ];
    const scheduled = new Map([
      ["a", 4800], // Double the target
      ["b", 0], // Nothing
    ]);
    const score = calculateFairnessScore(employees, scheduled, 7);
    expect(score).toBeLessThan(0.5);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("returns moderate score for slight imbalance", () => {
    const employees = [
      buildEmployee({ id: "a", weeklyHours: 40 }),
      buildEmployee({ id: "b", weeklyHours: 40 }),
    ];
    const scheduled = new Map([
      ["a", 2400], // 100%
      ["b", 2000], // ~83%
    ]);
    const score = calculateFairnessScore(employees, scheduled, 7);
    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// checkRestPeriod
// ═══════════════════════════════════════════════════════════════

describe("checkRestPeriod", () => {
  it("allows shift with no prior shifts", () => {
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    const slot = buildSlot({ startTime: "08:00", endTime: "16:00" });
    expect(checkRestPeriod(shiftTimes, "emp-1", slot)).toBe(true);
  });

  it("rejects shift when rest period is violated (same day)", () => {
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    // Employee had a shift 06:00-14:00, trying to assign 16:00-00:00 (only 2h gap)
    addShiftTime(shiftTimes, "emp-1", "2025-01-06", "06:00", "14:00");
    const slot = buildSlot({
      dateStr: "2025-01-06",
      date: new Date("2025-01-06"),
      startTime: "16:00",
      endTime: "23:00",
    });
    // Gap = 16:00 - 14:00 = 120 min < 660 min (11h)
    expect(checkRestPeriod(shiftTimes, "emp-1", slot)).toBe(false);
  });

  it("allows shift when rest period is satisfied (same day)", () => {
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    // Employee had shift 00:00-02:00, trying to assign 14:00-22:00 (12h gap)
    addShiftTime(shiftTimes, "emp-1", "2025-01-06", "00:00", "02:00");
    const slot = buildSlot({
      dateStr: "2025-01-06",
      date: new Date("2025-01-06"),
      startTime: "14:00",
      endTime: "22:00",
    });
    // Gap = 14:00 - 02:00 = 720 min > 660 min
    expect(checkRestPeriod(shiftTimes, "emp-1", slot)).toBe(true);
  });

  it("rejects shift when previous day shift violates rest", () => {
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    // Previous day shift ended at 23:00, trying to start at 06:00 (7h gap < 11h)
    addShiftTime(shiftTimes, "emp-1", "2025-01-05", "14:00", "23:00");
    const slot = buildSlot({
      dateStr: "2025-01-06",
      date: new Date("2025-01-06"),
      startTime: "06:00",
      endTime: "14:00",
    });
    // Gap = (24:00-23:00) + 06:00 = 60+360 = 420 min < 660 min
    expect(checkRestPeriod(shiftTimes, "emp-1", slot)).toBe(false);
  });

  it("allows shift when previous day shift has enough rest", () => {
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    // Previous day shift ended at 12:00, trying to start at 08:00 next day (20h gap)
    addShiftTime(shiftTimes, "emp-1", "2025-01-05", "06:00", "12:00");
    const slot = buildSlot({
      dateStr: "2025-01-06",
      date: new Date("2025-01-06"),
      startTime: "08:00",
      endTime: "16:00",
    });
    // Gap = (24:00-12:00) + 08:00 = 720+480 = 1200 min > 660 min
    expect(checkRestPeriod(shiftTimes, "emp-1", slot)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// computeDomain
// ═══════════════════════════════════════════════════════════════

describe("computeDomain", () => {
  it("includes available employee", () => {
    const emp = buildEmployee({ id: "emp-1" });
    const slot = buildSlot();
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).toContain("emp-1");
  });

  it("excludes employee on absence", () => {
    const emp = buildEmployee({
      id: "emp-1",
      absenceDates: new Set(["2025-01-06"]),
    });
    const slot = buildSlot();
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).not.toContain("emp-1");
  });

  it("excludes employee marked NICHT_VERFUEGBAR", () => {
    const emp = buildEmployee({
      id: "emp-1",
      availabilityMap: new Map([
        [
          0, // Monday (ISO weekday for 2025-01-06)
          [
            {
              startTime: null,
              endTime: null,
              type: "NICHT_VERFUEGBAR",
              validFrom: new Date("2025-01-01"),
              validUntil: null,
            },
          ],
        ],
      ]),
    });
    const slot = buildSlot(); // Monday 2025-01-06
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).not.toContain("emp-1");
  });

  it("excludes employee without required skill", () => {
    const emp = buildEmployee({
      id: "emp-1",
      skillIds: new Set(["skill-other"]),
    });
    const slot = buildSlot({ requiredSkillId: "skill-required" });
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).not.toContain("emp-1");
  });

  it("includes employee with required skill", () => {
    const emp = buildEmployee({
      id: "emp-1",
      skillIds: new Set(["skill-required"]),
    });
    const slot = buildSlot({ requiredSkillId: "skill-required" });
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).toContain("emp-1");
  });

  it("excludes employee exceeding max daily hours (10h)", () => {
    const emp = buildEmployee({ id: "emp-1" });
    const slot = buildSlot({ durationMinutes: 120 }); // 2h shift
    const dayMin = new Map<string, Map<string, number>>();
    // Employee already has 540 min (9h) scheduled for that day
    addMinutes(dayMin, "emp-1", "2025-01-06", 540);
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    // 540 + 120 = 660 > 600 (10h), should be excluded
    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).not.toContain("emp-1");
  });

  it("excludes employee exceeding max weekly hours (48h)", () => {
    const emp = buildEmployee({ id: "emp-1" });
    const slot = buildSlot({ durationMinutes: 480 }); // 8h shift
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    // Employee already has 2640 min (44h) scheduled this week
    addMinutes(weekMin, "emp-1", getWeekKey(new Date("2025-01-06")), 2640);
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();

    // 2640 + 480 = 3120 > 2880 (48h), should be excluded
    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).not.toContain("emp-1");
  });

  it("excludes employee with overlapping shift", () => {
    const emp = buildEmployee({ id: "emp-1" });
    const slot = buildSlot({
      startTime: "08:00",
      endTime: "16:00",
      durationMinutes: 480,
    });
    const dayMin = new Map<string, Map<string, number>>();
    const weekMin = new Map<string, Map<string, number>>();
    const shiftTimes = new Map<
      string,
      Map<string, Array<{ start: number; end: number }>>
    >();
    // Employee already has 10:00-14:00 shift (overlaps with 08:00-16:00)
    addShiftTime(shiftTimes, "emp-1", "2025-01-06", "10:00", "14:00");

    const result = computeDomain(slot, [emp], dayMin, weekMin, shiftTimes);
    expect(result).not.toContain("emp-1");
  });
});

// ═══════════════════════════════════════════════════════════════
// scoreEmployee
// ═══════════════════════════════════════════════════════════════

describe("scoreEmployee", () => {
  it("returns a positive base score", () => {
    const emp = buildEmployee();
    const slot = buildSlot();
    const totalScheduled = new Map<string, number>();
    const { score } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );
    expect(score).toBeGreaterThan(0);
  });

  it("gives bonus to preferred availability", () => {
    const emp = buildEmployee({
      availabilityMap: new Map([
        [
          0, // Monday
          [
            {
              startTime: "08:00",
              endTime: "16:00",
              type: "BEVORZUGT",
              validFrom: new Date("2025-01-01"),
              validUntil: null,
            },
          ],
        ],
      ]),
    });
    const empNoPreference = buildEmployee({ id: "emp-2" });
    const slot = buildSlot();
    const totalScheduled = new Map<string, number>();

    const { score: withPref } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );
    const { score: withoutPref } = scoreEmployee(
      empNoPreference,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );

    expect(withPref).toBeGreaterThan(withoutPref);
  });

  it("penalizes employees with overtime", () => {
    const emp = buildEmployee({ weeklyHours: 40 });
    const slot = buildSlot();
    const overloaded = new Map([["emp-1", 3000]]); // > 40h × 60 = 2400 by >10%
    const balanced = new Map([["emp-1", 0]]);

    const { score: overScore } = scoreEmployee(
      emp,
      slot,
      overloaded,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );
    const { score: balancedScore } = scoreEmployee(
      emp,
      slot,
      balanced,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );

    expect(balancedScore).toBeGreaterThan(overScore);
  });

  it("gives bonus for skill match", () => {
    const emp = buildEmployee({ skillIds: new Set(["skill-1"]) });
    const empNoSkill = buildEmployee({ id: "emp-2" });
    const slot = buildSlot({ requiredSkillId: "skill-1" });
    const totalScheduled = new Map<string, number>();

    const { score: withSkill } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );
    const { score: withoutSkill } = scoreEmployee(
      empNoSkill,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );

    expect(withSkill).toBeGreaterThan(withoutSkill);
  });

  it("includes explanatory reasons", () => {
    const emp = buildEmployee({
      weeklyHours: 40,
      skillIds: new Set(["skill-1"]),
      availabilityMap: new Map([
        [
          0,
          [
            {
              startTime: "08:00",
              endTime: "16:00",
              type: "BEVORZUGT",
              validFrom: new Date("2025-01-01"),
              validUntil: null,
            },
          ],
        ],
      ]),
    });
    const slot = buildSlot({ requiredSkillId: "skill-1" });
    const totalScheduled = new Map<string, number>();

    const { reasons } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );

    expect(reasons).toContain("Bevorzugte Zeit");
    expect(reasons).toContain("Qualifikation passt");
    expect(reasons).toContain("Wenig eingeplant");
  });

  it("penalizes consecutive working days (fatigue)", () => {
    const emp = buildEmployee();
    const slot = buildSlot();
    const totalScheduled = new Map<string, number>();

    // Employee has worked 5 consecutive days before the slot date
    const workDates = new Map<string, Set<string>>([
      [
        "emp-1",
        new Set([
          "2025-01-01",
          "2025-01-02",
          "2025-01-03",
          "2025-01-04",
          "2025-01-05",
          "2025-01-06", // slot date
        ]),
      ],
    ]);
    const noWorkDates = new Map<string, Set<string>>();

    const { score: fatiguedScore } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      workDates,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );
    const { score: restedScore } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      noWorkDates,
      EMPTY_WEEKEND_SHIFTS,
      EMPTY_LAST_CATEGORY,
    );

    expect(restedScore).toBeGreaterThan(fatiguedScore);
  });

  it("penalizes bad shift rotation (Nacht→Früh)", () => {
    const emp = buildEmployee();
    const slot = buildSlot({ startTime: "06:00", endTime: "14:00" }); // Frühschicht
    const totalScheduled = new Map<string, number>();

    // Last shift was Nachtschicht — bad rotation
    const badRotation = new Map<string, ShiftCategory>([["emp-1", "NACHT"]]);
    // Last shift was also Frühschicht — good continuity
    const goodRotation = new Map<string, ShiftCategory>([["emp-1", "FRUEH"]]);

    const { score: badScore } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      badRotation,
    );
    const { score: goodScore } = scoreEmployee(
      emp,
      slot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      EMPTY_WEEKEND_SHIFTS,
      goodRotation,
    );

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it("penalizes employees with many weekend shifts on weekend slots", () => {
    const emp = buildEmployee();
    const sundaySlot = buildSlot({
      date: new Date("2025-01-12"), // Sunday
      dateStr: "2025-01-12",
      isSundayShift: true,
    });
    const totalScheduled = new Map<string, number>();

    const manyWeekends = new Map<string, number>([["emp-1", 4]]);
    const noWeekends = new Map<string, number>();

    const { score: overloadedScore } = scoreEmployee(
      emp,
      sundaySlot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      manyWeekends,
      EMPTY_LAST_CATEGORY,
    );
    const { score: freshScore } = scoreEmployee(
      emp,
      sundaySlot,
      totalScheduled,
      7,
      DEFAULT_WEIGHTS,
      [],
      EMPTY_WORK_DATES,
      noWeekends,
      EMPTY_LAST_CATEGORY,
    );

    expect(freshScore).toBeGreaterThan(overloadedScore);
  });
});

// ═══════════════════════════════════════════════════════════════
// classifyShift
// ═══════════════════════════════════════════════════════════════

describe("classifyShift", () => {
  it("classifies early morning shift as FRUEH", () => {
    expect(classifyShift("06:00", "14:00")).toBe("FRUEH");
    expect(classifyShift("07:00", "13:00")).toBe("FRUEH");
    expect(classifyShift("05:00", "12:00")).toBe("FRUEH");
  });

  it("classifies afternoon shift as SPAET", () => {
    expect(classifyShift("14:00", "22:00")).toBe("SPAET");
    expect(classifyShift("13:00", "21:00")).toBe("SPAET");
    expect(classifyShift("15:00", "23:00")).toBe("SPAET");
  });

  it("classifies night shift as NACHT", () => {
    expect(classifyShift("22:00", "06:00")).toBe("NACHT");
    expect(classifyShift("20:00", "04:00")).toBe("NACHT");
    expect(classifyShift("23:00", "07:00")).toBe("NACHT");
  });

  it("classifies mid-day shift as OTHER", () => {
    expect(classifyShift("08:00", "16:00")).toBe("OTHER");
    expect(classifyShift("09:00", "17:00")).toBe("OTHER");
    expect(classifyShift("10:00", "18:00")).toBe("OTHER");
  });
});

// ═══════════════════════════════════════════════════════════════
// getConsecutiveDays
// ═══════════════════════════════════════════════════════════════

describe("getConsecutiveDays", () => {
  it("returns 0 for unknown employee", () => {
    expect(getConsecutiveDays(new Map(), "emp-unknown", "2025-01-06")).toBe(0);
  });

  it("returns 0 when employee has no work on that date", () => {
    const dates = new Map([["emp-1", new Set(["2025-01-05"])]]);
    expect(getConsecutiveDays(dates, "emp-1", "2025-01-07")).toBe(0);
  });

  it("counts consecutive days correctly", () => {
    const dates = new Map([
      [
        "emp-1",
        new Set(["2025-01-03", "2025-01-04", "2025-01-05", "2025-01-06"]),
      ],
    ]);
    expect(getConsecutiveDays(dates, "emp-1", "2025-01-06")).toBe(4);
  });

  it("breaks at gaps", () => {
    const dates = new Map([
      [
        "emp-1",
        new Set([
          "2025-01-03",
          // gap on 01-04
          "2025-01-05",
          "2025-01-06",
        ]),
      ],
    ]);
    expect(getConsecutiveDays(dates, "emp-1", "2025-01-06")).toBe(2);
  });

  it("returns 1 for single day", () => {
    const dates = new Map([["emp-1", new Set(["2025-01-06"])]]);
    expect(getConsecutiveDays(dates, "emp-1", "2025-01-06")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// getRotationPenalty
// ═══════════════════════════════════════════════════════════════

describe("getRotationPenalty", () => {
  it("returns 0 for same category", () => {
    expect(getRotationPenalty("FRUEH", "FRUEH")).toBe(0);
    expect(getRotationPenalty("SPAET", "SPAET")).toBe(0);
    expect(getRotationPenalty("NACHT", "NACHT")).toBe(0);
  });

  it("returns 0 for forward rotation (Früh→Spät)", () => {
    expect(getRotationPenalty("FRUEH", "SPAET")).toBe(0);
  });

  it("returns 0 for forward rotation (Spät→Nacht)", () => {
    expect(getRotationPenalty("SPAET", "NACHT")).toBe(0);
  });

  it("returns 1.5 for worst backward rotation (Nacht→Früh)", () => {
    expect(getRotationPenalty("NACHT", "FRUEH")).toBe(1.5);
  });

  it("returns 1.0 for backward rotation (Spät→Früh)", () => {
    expect(getRotationPenalty("SPAET", "FRUEH")).toBe(1.0);
  });

  it("returns 0.5 for mild backward rotation (Nacht→Spät)", () => {
    expect(getRotationPenalty("NACHT", "SPAET")).toBe(0.5);
  });

  it("returns small penalty for OTHER transitions", () => {
    expect(getRotationPenalty("OTHER", "FRUEH")).toBe(0.2);
    expect(getRotationPenalty("FRUEH", "OTHER")).toBe(0.2);
  });
});
