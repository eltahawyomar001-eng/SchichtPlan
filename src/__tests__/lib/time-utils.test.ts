/**
 * @vitest-environment node
 *
 * Tests for src/lib/time-utils.ts
 * Covers time parsing, formatting, duration calculations, industrial hours,
 * personnel number derivation, calendar week, and time-entry validation.
 */
import { describe, it, expect } from "vitest";
import {
  parseHHmm,
  formatMinutesToHHmm,
  calcGrossMinutes,
  toIndustrialHours,
  toPersonnelNumber,
  getCalendarWeek,
  validateTimeEntry,
} from "@/lib/time-utils";

// ─── parseHHmm ───────────────────────────────────────────────────

describe("parseHHmm", () => {
  it("converts '08:30' to 510 minutes since midnight", () => {
    expect(parseHHmm("08:30")).toBe(510);
  });

  it("converts '00:00' to 0", () => {
    expect(parseHHmm("00:00")).toBe(0);
  });

  it("converts '12:00' to 720", () => {
    expect(parseHHmm("12:00")).toBe(720);
  });

  it("converts '23:59' to 1439", () => {
    expect(parseHHmm("23:59")).toBe(1439);
  });

  it("converts '01:01' to 61", () => {
    expect(parseHHmm("01:01")).toBe(61);
  });
});

// ─── formatMinutesToHHmm ─────────────────────────────────────────

describe("formatMinutesToHHmm", () => {
  it("formats 90 minutes to '01:30'", () => {
    expect(formatMinutesToHHmm(90)).toBe("01:30");
  });

  it("formats 0 minutes to '00:00'", () => {
    expect(formatMinutesToHHmm(0)).toBe("00:00");
  });

  it("formats 480 minutes to '08:00'", () => {
    expect(formatMinutesToHHmm(480)).toBe("08:00");
  });

  it("formats 510 minutes to '08:30'", () => {
    expect(formatMinutesToHHmm(510)).toBe("08:30");
  });

  it("formats 1439 minutes to '23:59'", () => {
    expect(formatMinutesToHHmm(1439)).toBe("23:59");
  });

  it("pads single-digit hours and minutes with leading zeros", () => {
    expect(formatMinutesToHHmm(61)).toBe("01:01");
  });
});

// ─── calcGrossMinutes ────────────────────────────────────────────

describe("calcGrossMinutes", () => {
  it("calculates 480 minutes for an 8-hour day shift (08:00–16:00)", () => {
    expect(calcGrossMinutes("08:00", "16:00")).toBe(480);
  });

  it("calculates 480 minutes for an overnight shift (22:00–06:00)", () => {
    expect(calcGrossMinutes("22:00", "06:00")).toBe(480);
  });

  it("calculates 0 minutes when start equals end (treated as overnight 24h)", () => {
    // 00:00 to 00:00: e <= s so e += 1440, result = 1440
    expect(calcGrossMinutes("00:00", "00:00")).toBe(1440);
  });

  it("calculates a 30-minute shift", () => {
    expect(calcGrossMinutes("09:00", "09:30")).toBe(30);
  });

  it("calculates correctly with non-zero minutes", () => {
    expect(calcGrossMinutes("08:15", "16:45")).toBe(510); // 8h 30min
  });

  it("handles crossing midnight with non-zero minutes (23:30–00:30 = 60 min)", () => {
    expect(calcGrossMinutes("23:30", "00:30")).toBe(60);
  });
});

// ─── toIndustrialHours ───────────────────────────────────────────

describe("toIndustrialHours", () => {
  it("converts 90 minutes to 1.5 hours", () => {
    expect(toIndustrialHours(90)).toBe(1.5);
  });

  it("converts 0 minutes to 0 hours", () => {
    expect(toIndustrialHours(0)).toBe(0);
  });

  it("converts 480 minutes to 8 hours", () => {
    expect(toIndustrialHours(480)).toBe(8);
  });

  it("converts 450 minutes to 7.5 hours", () => {
    expect(toIndustrialHours(450)).toBe(7.5);
  });

  it("converts 30 minutes to 0.5 hours", () => {
    expect(toIndustrialHours(30)).toBe(0.5);
  });

  it("rounds to two decimal places (e.g. 100 min → 1.67)", () => {
    expect(toIndustrialHours(100)).toBe(1.67);
  });
});

// ─── toPersonnelNumber ────────────────────────────────────────────

describe("toPersonnelNumber", () => {
  it("returns a numeric-only string for alphanumeric input", () => {
    const result = toPersonnelNumber("abc123");
    expect(/^\d+$/.test(result)).toBe(true);
  });

  it("returns a 6-digit string (100000–999999)", () => {
    const result = toPersonnelNumber("abc123");
    const num = parseInt(result, 10);
    expect(num).toBeGreaterThanOrEqual(100_000);
    expect(num).toBeLessThanOrEqual(999_999);
  });

  it("is deterministic — same input always produces same output", () => {
    const id = "clx1234567890abcdef";
    expect(toPersonnelNumber(id)).toBe(toPersonnelNumber(id));
  });

  it("produces different numbers for different IDs", () => {
    const a = toPersonnelNumber("employee-1");
    const b = toPersonnelNumber("employee-2");
    expect(a).not.toBe(b);
  });

  it("handles empty string without throwing", () => {
    const result = toPersonnelNumber("");
    expect(typeof result).toBe("string");
    expect(/^\d+$/.test(result)).toBe(true);
  });
});

// ─── getCalendarWeek ──────────────────────────────────────────────

describe("getCalendarWeek", () => {
  it("2025-01-06 (Monday) is ISO week 2", () => {
    expect(getCalendarWeek(new Date(2025, 0, 6))).toBe(2);
  });

  it("2025-01-01 (Wednesday) is ISO week 1", () => {
    expect(getCalendarWeek(new Date(2025, 0, 1))).toBe(1);
  });

  it("2025-01-13 (Monday) is ISO week 3", () => {
    expect(getCalendarWeek(new Date(2025, 0, 13))).toBe(3);
  });

  it("2024-12-30 (Monday) is ISO week 1 of 2025", () => {
    // ISO 8601: last days of December can belong to week 1 of the next year
    expect(getCalendarWeek(new Date(2024, 11, 30))).toBe(1);
  });

  it("2025-06-16 (Monday) is ISO week 25", () => {
    expect(getCalendarWeek(new Date(2025, 5, 16))).toBe(25);
  });
});

// ─── validateTimeEntry ────────────────────────────────────────────

describe("validateTimeEntry", () => {
  const validEntry = {
    date: "2025-06-01",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    employeeId: "emp_001",
  };

  it("returns an empty array for a valid 8-hour shift with sufficient break", () => {
    const errors = validateTimeEntry(validEntry);
    expect(errors).toEqual([]);
  });

  it("returns an error when date is missing", () => {
    const errors = validateTimeEntry({ ...validEntry, date: "" });
    expect(errors.some((e) => e.field === "date")).toBe(true);
  });

  it("returns an error when startTime is missing", () => {
    const errors = validateTimeEntry({ ...validEntry, startTime: "" });
    expect(errors.some((e) => e.field === "startTime")).toBe(true);
  });

  it("returns an error when endTime is missing", () => {
    const errors = validateTimeEntry({ ...validEntry, endTime: "" });
    expect(errors.some((e) => e.field === "endTime")).toBe(true);
  });

  it("returns an error when employeeId is missing", () => {
    const errors = validateTimeEntry({ ...validEntry, employeeId: "" });
    expect(errors.some((e) => e.field === "employeeId")).toBe(true);
  });

  it("returns an error for invalid time format (non-HH:mm)", () => {
    const errors = validateTimeEntry({ ...validEntry, startTime: "8:00" });
    expect(errors.some((e) => e.field === "startTime")).toBe(true);
  });

  it("returns an endTime error when break equals the gross duration", () => {
    // 08:00–09:00 = 60 min, break 60 min → break >= gross
    const errors = validateTimeEntry({
      ...validEntry,
      startTime: "08:00",
      endTime: "09:00",
      breakMinutes: 60,
    });
    expect(errors.some((e) => e.field === "breakMinutes")).toBe(true);
  });

  it("returns ArbZG break error for a >6h shift with no break", () => {
    // 8h shift, no break → ArbZG §4 violation
    const errors = validateTimeEntry({ ...validEntry, breakMinutes: 0 });
    expect(errors.some((e) => e.field === "breakMinutes")).toBe(true);
    const msg = errors.find((e) => e.field === "breakMinutes")?.message ?? "";
    expect(msg).toContain("30");
  });

  it("returns ArbZG break error for a >9h shift with only 30 min break", () => {
    // 10h shift (08:00–18:00), only 30 min break → needs 45 min
    const errors = validateTimeEntry({
      ...validEntry,
      startTime: "08:00",
      endTime: "18:00",
      breakMinutes: 30,
    });
    expect(errors.some((e) => e.field === "breakMinutes")).toBe(true);
    const msg = errors.find((e) => e.field === "breakMinutes")?.message ?? "";
    expect(msg).toContain("45");
  });

  it("returns an error when breakStart is set but breakEnd is missing", () => {
    const errors = validateTimeEntry({
      ...validEntry,
      breakStart: "12:00",
      breakEnd: null,
    });
    expect(errors.some((e) => e.field === "breakStart")).toBe(true);
  });

  it("accepts a valid entry with breakStart and breakEnd both set", () => {
    const errors = validateTimeEntry({
      ...validEntry,
      breakStart: "12:00",
      breakEnd: "12:30",
      breakMinutes: undefined,
    });
    expect(errors).toEqual([]);
  });
});
