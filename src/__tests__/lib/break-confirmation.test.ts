/**
 * The confirmation control.
 *
 * The spec allows a break to be booked after the fact only once somebody has
 * confirmed it was genuinely taken. These tests pin the property that makes
 * that rule mean anything: an unconfirmed break cannot reduce a §4 shortfall.
 * If it ever could, the breach this system exists to surface could be erased
 * by typing a break into the record.
 */
import { describe, it, expect } from "vitest";
import { assessEntry } from "@/lib/time-entry-assessment";

/** 08:00–17:00, nine hours on the clock with no break recorded anywhere. */
const nineHourDay = { startTime: "08:00", endTime: "17:00" };

describe("an unconfirmed break is inert", () => {
  it("does not reduce the shortfall", () => {
    const a = assessEntry({
      ...nineHourDay,
      breaks: [
        { startOffsetMinutes: 240, endOffsetMinutes: 270, confirmed: false },
      ],
    });
    expect(a.breaks.recordedBreakMinutes).toBe(0);
    expect(a.breaks.breakShortfallMinutes).toBe(30);
    expect(a.deviationCodes).toContain("BREAK_MISSING");
  });

  it("does not shorten the longest unbroken stretch", () => {
    // Otherwise an unconfirmed row could clear a six-hour-stretch finding,
    // which is the same breach wearing a different name.
    const a = assessEntry({
      startTime: "06:00",
      endTime: "17:00",
      breaks: [
        { startOffsetMinutes: 300, endOffsetMinutes: 345, confirmed: false },
      ],
    });
    expect(a.deviationCodes).toContain("STRETCH_OVER_6H");
  });
});

describe("confirming it makes it count", () => {
  it("clears the shortfall once confirmed", () => {
    const a = assessEntry({
      ...nineHourDay,
      breaks: [
        { startOffsetMinutes: 240, endOffsetMinutes: 270, confirmed: true },
      ],
    });
    expect(a.breaks.recordedBreakMinutes).toBe(30);
    expect(a.breaks.breakShortfallMinutes).toBe(0);
    expect(a.breaks.compliant).toBe(true);
  });

  it("counts only the confirmed rows when some are pending", () => {
    const a = assessEntry({
      ...nineHourDay,
      breaks: [
        { startOffsetMinutes: 240, endOffsetMinutes: 260, confirmed: true },
        { startOffsetMinutes: 400, endOffsetMinutes: 430, confirmed: false },
      ],
    });
    expect(a.breaks.recordedBreakMinutes).toBe(20);
    expect(a.breaks.breakShortfallMinutes).toBe(10);
  });

  it("recomputes working time from the confirmed break", () => {
    // The worked total has to move too, or the §4 threshold is measured
    // against the wrong number.
    const a = assessEntry({
      ...nineHourDay,
      breaks: [
        { startOffsetMinutes: 240, endOffsetMinutes: 285, confirmed: true },
      ],
    });
    expect(a.breaks.workedMinutes).toBe(495);
  });
});

describe("withdrawing a confirmation", () => {
  it("restores the breach it had cleared", () => {
    // Modelled as the same entry with confirmed flipped back: a manager who
    // took back their statement must not leave the day looking compliant.
    const confirmed = assessEntry({
      ...nineHourDay,
      breaks: [
        { startOffsetMinutes: 240, endOffsetMinutes: 270, confirmed: true },
      ],
    });
    const withdrawn = assessEntry({
      ...nineHourDay,
      breaks: [
        { startOffsetMinutes: 240, endOffsetMinutes: 270, confirmed: false },
      ],
    });
    expect(confirmed.breaks.compliant).toBe(true);
    expect(withdrawn.breaks.compliant).toBe(false);
    expect(withdrawn.breaks.breakShortfallMinutes).toBe(30);
  });
});
