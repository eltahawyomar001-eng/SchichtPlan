/**
 * The bridge from stored rows to deviations. Most of the risk here is in how
 * a break is stored, not in the law, so that is where the tests concentrate.
 */
import { describe, it, expect } from "vitest";
import { assessEntry, type AssessableEntry } from "@/lib/time-entry-assessment";

const entry = (over: Partial<AssessableEntry> = {}): AssessableEntry => ({
  startTime: "08:00",
  endTime: "17:00",
  ...over,
});

describe("legacy breakStart/breakEnd strings", () => {
  it("reads them as times, not as Dates", () => {
    // `new Date("12:30")` is Invalid Date and every subtraction from it is
    // NaN, which would read as a day with no break and a false §4 breach.
    const a = assessEntry(entry({ breakStart: "12:00", breakEnd: "12:30" }));
    expect(a.breaks.recordedBreakMinutes).toBe(30);
    expect(Number.isNaN(a.breaks.workedMinutes)).toBe(false);
    expect(a.breaks.workedMinutes).toBe(510);
  });

  it("keeps the timing, so the six-hour stretch is still checked", () => {
    // Break at the very end: 45 minutes total is enough, the placement is not.
    const a = assessEntry(
      entry({
        startTime: "06:00",
        endTime: "17:00",
        breakStart: "16:15",
        breakEnd: "17:00",
      }),
    );
    expect(a.breaks.recordedBreakMinutes).toBe(45);
    expect(a.deviationCodes).toContain("STRETCH_OVER_6H");
  });

  it("handles a break that crosses midnight on a night shift", () => {
    const a = assessEntry(
      entry({
        startTime: "22:00",
        endTime: "06:00",
        breakStart: "23:40",
        breakEnd: "00:10",
      }),
    );
    expect(a.breaks.recordedBreakMinutes).toBe(30);
  });
});

describe("entries with only a break total", () => {
  it("still subtracts it", () => {
    const a = assessEntry(entry({ breakMinutes: 30 }));
    expect(a.breaks.recordedBreakMinutes).toBe(30);
    expect(a.breaks.workedMinutes).toBe(510);
  });

  it("does not invent a stretch breach from unknown timing", () => {
    // Placing an unknown break at one end would manufacture either a breach or
    // compliance. The middle asserts neither.
    const a = assessEntry(entry({ breakMinutes: 45 }));
    expect(a.deviationCodes).not.toContain("STRETCH_OVER_6H");
  });
});

describe("modern break rows", () => {
  it("prefers confirmed rows over the legacy pair", () => {
    const a = assessEntry(
      entry({
        breakStart: "12:00",
        breakEnd: "12:15",
        breaks: [
          { startOffsetMinutes: 240, endOffsetMinutes: 285, confirmed: true },
        ],
      }),
    );
    expect(a.breaks.recordedBreakMinutes).toBe(45);
  });

  it("ignores unconfirmed rows", () => {
    // A claim is not rest. Counting it would let a missing break be papered
    // over by entering one afterwards.
    const a = assessEntry(
      entry({
        breaks: [
          { startOffsetMinutes: 240, endOffsetMinutes: 285, confirmed: false },
        ],
      }),
    );
    expect(a.breaks.recordedBreakMinutes).toBe(0);
    expect(a.deviationCodes).toContain("BREAK_MISSING");
  });

  it("falls back to the legacy pair when every row is unconfirmed", () => {
    const a = assessEntry(
      entry({
        breakStart: "12:00",
        breakEnd: "12:30",
        breaks: [
          { startOffsetMinutes: 240, endOffsetMinutes: 285, confirmed: false },
        ],
      }),
    );
    expect(a.breaks.recordedBreakMinutes).toBe(30);
  });
});

describe("lateness", () => {
  it("compares the clock-in against the rostered start", () => {
    const a = assessEntry(entry({ startTime: "08:12" }), "08:00");
    expect(a.lateness?.minutes).toBe(12);
    expect(a.lateness?.severity).toBe("YELLOW");
  });

  it("is null, not zero, when there is no shift to compare against", () => {
    // Unplanned attendance is not punctual; it is unmeasurable.
    expect(assessEntry(entry()).lateness).toBeNull();
  });

  it("flags a late entry with no explanation", () => {
    const a = assessEntry(entry({ startTime: "08:30" }), "08:00");
    expect(a.latenessReasonMissing).toBe(true);
    expect(a.deviationCodes).toContain("LATENESS_REASON_MISSING");
  });

  it("clears the flag once a reason is recorded", () => {
    const a = assessEntry(
      entry({ startTime: "08:30", latenessReason: "Zugausfall" }),
      "08:00",
    );
    expect(a.latenessReasonMissing).toBe(false);
  });

  it("treats whitespace as no reason at all", () => {
    const a = assessEntry(
      entry({ startTime: "08:30", latenessReason: "   " }),
      "08:00",
    );
    expect(a.latenessReasonMissing).toBe(true);
  });

  it("asks for no reason when on time", () => {
    const a = assessEntry(entry({ startTime: "07:58" }), "08:00");
    expect(a.latenessReasonMissing).toBe(false);
    expect(a.deviationCodes).not.toContain("LATE");
  });
});

describe("a compliant day", () => {
  it("reports nothing to act on", () => {
    const a = assessEntry(
      entry({ breakStart: "12:00", breakEnd: "12:30" }),
      "08:00",
    );
    expect(a.deviationCodes).toEqual([]);
    expect(a.breaks.compliant).toBe(true);
  });
});
