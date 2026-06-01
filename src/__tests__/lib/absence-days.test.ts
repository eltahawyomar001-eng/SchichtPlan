/**
 * @vitest-environment node
 *
 * Tests for the pure `classifyAbsenceDays` helper in absence-days.ts.
 *
 * This function is the core of the vacation balance calculation engine.
 * Only working days are deducted — public holidays and weekends are NOT.
 * Half-day flags shave 0.5 from the deductible count.
 *
 * We test the pure helper directly (no DB calls) using Berlin (BE)
 * as the Bundesland since it's the fallback and has a known holiday set.
 */
import { describe, it, expect } from "vitest";
import { classifyAbsenceDays } from "@/lib/absence-days";

// ─── Helpers ────────────────────────────────────────────────────

function date(iso: string) {
  // Parse as midnight UTC then convert to Date
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// ─── Basic weekday counting ──────────────────────────────────────

describe("classifyAbsenceDays — basic weekday counting", () => {
  it("returns 0 deductible days for a weekend range", () => {
    // 2025-01-04 is Saturday, 2025-01-05 is Sunday
    const r = classifyAbsenceDays({
      startDate: date("2025-01-04"),
      endDate: date("2025-01-05"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0);
    expect(r.breakdown).toHaveLength(2);
    expect(r.breakdown[0].kind).toBe("WEEKEND");
    expect(r.breakdown[1].kind).toBe("WEEKEND");
  });

  it("counts 5 deductible days for Mon–Fri", () => {
    // 2025-01-06 (Mon) to 2025-01-10 (Fri)
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-10"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(5);
    expect(r.breakdown.every((d) => d.kind === "VACATION")).toBe(true);
  });

  it("counts 5 deductible days for Mon–Sun (weekends excluded)", () => {
    // 2025-01-06 (Mon) to 2025-01-12 (Sun)
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-12"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(5);
    expect(r.breakdown).toHaveLength(7);
    const weekends = r.breakdown.filter((d) => d.kind === "WEEKEND");
    expect(weekends).toHaveLength(2);
  });

  it("counts 1 deductible day for a single Monday", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-06"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(1);
  });

  it("counts 0 deductible days for a single Saturday", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-04"),
      endDate: date("2025-01-04"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0);
  });
});

// ─── Public holidays ─────────────────────────────────────────────

describe("classifyAbsenceDays — public holiday handling", () => {
  it("does not deduct New Year's Day (Neujahr) — 2025-01-01", () => {
    // 2025-01-01 is Wednesday (a working day in all Bundesländer)
    const r = classifyAbsenceDays({
      startDate: date("2025-01-01"),
      endDate: date("2025-01-01"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0);
    expect(r.holidayCount).toBe(1);
    expect(r.breakdown[0].kind).toBe("HOLIDAY");
    expect(r.breakdown[0].holidayName).toBeDefined();
  });

  it("does not deduct Christmas (Weihnachtstag 1) — 2025-12-25", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-12-25"),
      endDate: date("2025-12-25"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0);
    expect(r.holidayCount).toBe(1);
    expect(r.breakdown[0].kind).toBe("HOLIDAY");
  });

  it("counts only working days in a week that includes a public holiday", () => {
    // 2025-10-06 (Mon) to 2025-10-10 (Fri) — Thu 2025-10-03 is Tag der Deutschen Einheit
    // Actually let's use a week where the holiday falls
    // German Unity Day 2025 = Thursday 2025-10-02 (Thu) — use whole week
    const r = classifyAbsenceDays({
      startDate: date("2025-09-29"), // Mon
      endDate: date("2025-10-05"), // Sun (incl Tag der Deutschen Einheit 10-03 Thu)
      bundesland: "BE",
    });
    // Mon, Tue, Wed are vacation; Thu is holiday; Fri is vacation; Sat,Sun are weekend
    expect(r.holidayCount).toBe(1);
    expect(r.deductibleDays).toBe(4); // Mon Tue Wed Fri
  });

  it("reports bundesland in the result", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-06"),
      bundesland: "BY",
    });
    expect(r.bundesland).toBe("BY");
  });
});

// ─── Half-day adjustments ────────────────────────────────────────

describe("classifyAbsenceDays — half-day flags", () => {
  it("deducts 0.5 for halfDayStart on a vacation day", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"), // Monday
      endDate: date("2025-01-06"),
      halfDayStart: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0.5);
  });

  it("deducts 0.5 for halfDayEnd on a vacation day", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-06"),
      halfDayEnd: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0.5);
  });

  it("deducts 1.0 for both halfDayStart and halfDayEnd on the same day", () => {
    // Both flags on a single-day absence = effectively 0 vacation days
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-06"),
      halfDayStart: true,
      halfDayEnd: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0);
  });

  it("deducts 0.5 from start of a multi-day absence", () => {
    // 5-day week, halfDayStart on Monday = 4.5
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"), // Mon
      endDate: date("2025-01-10"), // Fri
      halfDayStart: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(4.5);
  });

  it("deducts 0.5 from end of a multi-day absence", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-10"),
      halfDayEnd: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(4.5);
  });

  it("deducts 1.0 for both half-day flags across a 5-day range", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-10"),
      halfDayStart: true,
      halfDayEnd: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(4);
  });

  it("does NOT deduct for halfDayStart when first day is a weekend", () => {
    // Start on Saturday — half-day flag is a no-op
    const r = classifyAbsenceDays({
      startDate: date("2025-01-04"), // Sat
      endDate: date("2025-01-06"), // Mon
      halfDayStart: true,
      bundesland: "BE",
    });
    // Sat is WEEKEND, Sun is WEEKEND, Mon is VACATION (1 day)
    expect(r.deductibleDays).toBe(1);
  });

  it("does NOT deduct for halfDayEnd when last day is a public holiday", () => {
    // New Year's Day (2025-01-01) as the last day with halfDayEnd
    const r = classifyAbsenceDays({
      startDate: date("2025-01-01"),
      endDate: date("2025-01-01"),
      halfDayEnd: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0); // holiday, not a vacation day
  });
});

// ─── Edge cases ──────────────────────────────────────────────────

describe("classifyAbsenceDays — edge cases", () => {
  it("handles a single-day range on a vacation day", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-03-03"), // Monday
      endDate: date("2025-03-03"),
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(1);
    expect(r.breakdown).toHaveLength(1);
  });

  it("never returns negative deductibleDays", () => {
    // Pathological: start and end both have half-day flags but both fall on weekends
    const r = classifyAbsenceDays({
      startDate: date("2025-01-04"), // Sat
      endDate: date("2025-01-05"), // Sun
      halfDayStart: true,
      halfDayEnd: true,
      bundesland: "BE",
    });
    expect(r.deductibleDays).toBe(0); // clamped to 0 by Math.max
  });

  it("returns correct breakdown length", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-15"), // 10 days
      bundesland: "BE",
    });
    expect(r.breakdown).toHaveLength(10);
  });

  it("each breakdown entry has a date and kind", () => {
    const r = classifyAbsenceDays({
      startDate: date("2025-01-06"),
      endDate: date("2025-01-10"),
      bundesland: "BE",
    });
    for (const day of r.breakdown) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("kind");
      expect(["WORK", "WEEKEND", "HOLIDAY", "VACATION"]).toContain(day.kind);
    }
  });
});
