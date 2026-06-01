/**
 * @vitest-environment node
 *
 * Tests for src/lib/holidays.ts
 * Covers German public holiday detection, Sunday detection, night-shift
 * classification, surcharge calculation, and the holiday list itself.
 */
import { describe, it, expect } from "vitest";
import {
  isPublicHoliday,
  isSunday,
  isNightShift,
  calculateSurcharge,
  getGermanHolidays,
} from "@/lib/holidays";

// ─── isPublicHoliday ─────────────────────────────────────────────

describe("isPublicHoliday", () => {
  it("recognises New Year's Day (2025-01-01) as a holiday", () => {
    const result = isPublicHoliday(new Date(2025, 0, 1), "BE");
    expect(result.isHoliday).toBe(true);
    expect(result.name).toBe("Neujahr");
  });

  it("recognises Christmas Day (2025-12-25) as a holiday", () => {
    const result = isPublicHoliday(new Date(2025, 11, 25), "NW");
    expect(result.isHoliday).toBe(true);
    expect(result.name).toBe("1. Weihnachtstag");
  });

  it("recognises Tag der Deutschen Einheit (2025-10-03) as a holiday", () => {
    const result = isPublicHoliday(new Date(2025, 9, 3), "HH");
    expect(result.isHoliday).toBe(true);
    expect(result.name).toBe("Tag der Deutschen Einheit");
  });

  it("returns false for a regular working day (2025-03-12, Wednesday)", () => {
    const result = isPublicHoliday(new Date(2025, 2, 12), "BY");
    expect(result.isHoliday).toBe(false);
    expect(result.name).toBeUndefined();
  });

  it("returns false for a Saturday that is not a holiday (2025-06-07)", () => {
    const result = isPublicHoliday(new Date(2025, 5, 7), "BE");
    expect(result.isHoliday).toBe(false);
  });

  it("returns false for a Sunday that is not a holiday (2025-03-16)", () => {
    const result = isPublicHoliday(new Date(2025, 2, 16), "BY");
    expect(result.isHoliday).toBe(false);
  });

  it("Mariä Himmelfahrt (2025-08-15) is a holiday in Bayern (BY)", () => {
    const result = isPublicHoliday(new Date(2025, 7, 15), "BY");
    expect(result.isHoliday).toBe(true);
    expect(result.name).toBe("Mariä Himmelfahrt");
  });

  it("Mariä Himmelfahrt (2025-08-15) is NOT a holiday in Berlin (BE)", () => {
    const result = isPublicHoliday(new Date(2025, 7, 15), "BE");
    expect(result.isHoliday).toBe(false);
  });
});

// ─── isSunday ────────────────────────────────────────────────────

describe("isSunday", () => {
  it("returns true for an actual Sunday (2025-01-05)", () => {
    expect(isSunday(new Date(2025, 0, 5))).toBe(true);
  });

  it("returns true for another Sunday (2025-06-01)", () => {
    expect(isSunday(new Date(2025, 5, 1))).toBe(true);
  });

  it("returns false for a Monday (2025-01-06)", () => {
    expect(isSunday(new Date(2025, 0, 6))).toBe(false);
  });

  it("returns false for a Saturday (2025-01-04)", () => {
    expect(isSunday(new Date(2025, 0, 4))).toBe(false);
  });

  it("returns false for a Wednesday (2025-03-12)", () => {
    expect(isSunday(new Date(2025, 2, 12))).toBe(false);
  });
});

// ─── isNightShift ────────────────────────────────────────────────

describe("isNightShift", () => {
  it("returns false for a regular day shift (08:00–16:00)", () => {
    expect(isNightShift("08:00", "16:00")).toBe(false);
  });

  it("returns false for an afternoon shift (14:00–22:00)", () => {
    // ends exactly at 22:00, night window starts at 23:00
    expect(isNightShift("14:00", "22:00")).toBe(false);
  });

  it("returns true for a classic overnight night shift (22:00–06:00)", () => {
    expect(isNightShift("22:00", "06:00")).toBe(true);
  });

  it("returns true when shift ends after 23:00 (20:00–23:30)", () => {
    expect(isNightShift("20:00", "23:30")).toBe(true);
  });

  it("returns true when shift starts before 06:00 (04:00–12:00)", () => {
    expect(isNightShift("04:00", "12:00")).toBe(true);
  });

  it("returns true for an overnight shift spanning midnight (23:00–07:00)", () => {
    expect(isNightShift("23:00", "07:00")).toBe(true);
  });

  it("returns false for shift ending exactly at 23:00 boundary (14:00–23:00)", () => {
    // 23:00 is NOT > nightStart (also 23:00), so not a night shift
    expect(isNightShift("14:00", "23:00")).toBe(false);
  });
});

// ─── calculateSurcharge ──────────────────────────────────────────

describe("calculateSurcharge", () => {
  it("returns 0 for a normal weekday day shift (no surcharges)", () => {
    expect(
      calculateSurcharge({ isNight: false, isSunday: false, isHoliday: false }),
    ).toBe(0);
  });

  it("returns 50 for Sunday work only", () => {
    expect(
      calculateSurcharge({ isNight: false, isSunday: true, isHoliday: false }),
    ).toBe(50);
  });

  it("returns 25 for night work only", () => {
    expect(
      calculateSurcharge({ isNight: true, isSunday: false, isHoliday: false }),
    ).toBe(25);
  });

  it("returns 150 for holiday work only", () => {
    expect(
      calculateSurcharge({ isNight: false, isSunday: false, isHoliday: true }),
    ).toBe(150);
  });

  it("returns 175 for night + holiday (25 + 150)", () => {
    expect(
      calculateSurcharge({ isNight: true, isSunday: false, isHoliday: true }),
    ).toBe(175);
  });

  it("returns 225 for all three flags set (25 + 50 + 150)", () => {
    expect(
      calculateSurcharge({ isNight: true, isSunday: true, isHoliday: true }),
    ).toBe(225);
  });

  it("returns 75 for Sunday + night (50 + 25)", () => {
    expect(
      calculateSurcharge({ isNight: true, isSunday: true, isHoliday: false }),
    ).toBe(75);
  });
});

// ─── getGermanHolidays ────────────────────────────────────────────

describe("getGermanHolidays", () => {
  const holidays2025 = getGermanHolidays(2025);

  it("returns an array with at least 9 entries (federal holidays)", () => {
    expect(holidays2025.length).toBeGreaterThanOrEqual(9);
  });

  it("every entry has the required properties", () => {
    for (const h of holidays2025) {
      expect(h).toHaveProperty("date");
      expect(h).toHaveProperty("name");
      expect(h).toHaveProperty("isNational");
      expect(h).toHaveProperty("bundeslaender");
      expect(typeof h.date).toBe("string");
      expect(typeof h.name).toBe("string");
      expect(typeof h.isNational).toBe("boolean");
      expect(Array.isArray(h.bundeslaender)).toBe(true);
    }
  });

  it("date strings are in YYYY-MM-DD format", () => {
    for (const h of holidays2025) {
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("includes Neujahr on 2025-01-01", () => {
    const neujahr = holidays2025.find((h) => h.name === "Neujahr");
    expect(neujahr).toBeDefined();
    expect(neujahr!.date).toBe("2025-01-01");
    expect(neujahr!.isNational).toBe(true);
  });

  it("includes Tag der Deutschen Einheit on 2025-10-03", () => {
    const unity = holidays2025.find(
      (h) => h.name === "Tag der Deutschen Einheit",
    );
    expect(unity).toBeDefined();
    expect(unity!.date).toBe("2025-10-03");
    expect(unity!.isNational).toBe(true);
  });

  it("includes 1. Weihnachtstag on 2025-12-25", () => {
    const xmas = holidays2025.find((h) => h.name === "1. Weihnachtstag");
    expect(xmas).toBeDefined();
    expect(xmas!.date).toBe("2025-12-25");
    expect(xmas!.isNational).toBe(true);
  });

  it("includes Mariä Himmelfahrt (regional, Bayern only) on 2025-08-15", () => {
    const maria = holidays2025.find((h) => h.name === "Mariä Himmelfahrt");
    expect(maria).toBeDefined();
    expect(maria!.date).toBe("2025-08-15");
    expect(maria!.isNational).toBe(false);
    expect(maria!.bundeslaender).toContain("BY");
    expect(maria!.bundeslaender).not.toContain("BE");
  });

  it("returns different Easter-based dates for a different year (2024)", () => {
    const holidays2024 = getGermanHolidays(2024);
    const karfreitag2025 = holidays2025.find((h) => h.name === "Karfreitag");
    const karfreitag2024 = holidays2024.find((h) => h.name === "Karfreitag");
    // Easter shifts year to year
    expect(karfreitag2025!.date).not.toBe(karfreitag2024!.date);
  });
});
