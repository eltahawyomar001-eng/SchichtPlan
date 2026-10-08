/**
 * §4 on recorded time. The thresholds are law, so they are pinned exactly,
 * including the boundaries where an off-by-one minute changes the answer.
 */
import { describe, it, expect } from "vitest";
import { assessRecordedBreaks, type RecordedBreak } from "@/lib/arbzg-breaks";

const br = (start: number, end: number): RecordedBreak => ({
  startOffsetMinutes: start,
  endOffsetMinutes: end,
});

const assess = (grossMinutes: number, breaks: RecordedBreak[] = []) =>
  assessRecordedBreaks({ grossMinutes, breaks });

describe("the statutory thresholds", () => {
  it("requires nothing at exactly six hours", () => {
    expect(assess(360).requiredBreakMinutes).toBe(0);
  });

  it("requires 30 minutes one minute above six hours", () => {
    // 6h01 of WORKING time. The boundary is the whole point of the rule.
    expect(assess(361).requiredBreakMinutes).toBe(30);
  });

  it("still requires only 30 minutes at exactly nine hours", () => {
    expect(assess(540 + 30, [br(240, 270)]).workedMinutes).toBe(540);
    expect(assess(540 + 30, [br(240, 270)]).requiredBreakMinutes).toBe(30);
  });

  it("requires 45 minutes one minute above nine hours", () => {
    // The mistake this guards against is keying 45 to TEN hours, which is the
    // §3 daily ceiling and under-reports everyone between nine and ten.
    const a = assess(541 + 30, [br(240, 270)]);
    expect(a.workedMinutes).toBe(541);
    expect(a.requiredBreakMinutes).toBe(45);
  });

  it("does not wait until ten hours for the 45-minute step", () => {
    const a = assess(600, [br(240, 270)]); // 9h30 worked
    expect(a.workedMinutes).toBe(570);
    expect(a.requiredBreakMinutes).toBe(45);
  });
});

describe("working time is attendance minus breaks", () => {
  it("measures the requirement against worked time, not attendance", () => {
    // 6h30 on the clock with a 35-minute break is 5h55 of work: under six
    // hours, so nothing is required even though attendance exceeds six.
    const a = assess(390, [br(180, 215)]);
    expect(a.workedMinutes).toBe(355);
    expect(a.requiredBreakMinutes).toBe(0);
    expect(a.compliant).toBe(true);
  });
});

describe("breaks are never deducted twice", () => {
  it("subtracts only what was recorded", () => {
    const a = assess(480, [br(240, 270)]);
    expect(a.recordedBreakMinutes).toBe(30);
    expect(a.workedMinutes).toBe(450);
  });

  it("does not subtract the statutory minimum on top of the recorded break", () => {
    // 8h30 attendance, 30 min taken. Worked is 8h, not 7h30: the requirement
    // is a threshold to compare against, not a second subtraction.
    const a = assess(510, [br(240, 270)]);
    expect(a.workedMinutes).toBe(480);
    expect(a.compliant).toBe(true);
  });

  it("counts overlapping rows once", () => {
    // A live-clock pause and a manual correction can cover the same minutes.
    // Adding them would credit rest that was never taken.
    const a = assess(480, [br(240, 280), br(260, 300)]);
    expect(a.recordedBreakMinutes).toBe(60);
  });
});

describe("a missing break is flagged, never deducted", () => {
  it("leaves worked time untouched when no break was taken", () => {
    // The tidy alternative -- silently subtracting 30 -- records working time
    // that did not happen and hides the breach the law wants surfaced.
    const a = assess(480);
    expect(a.workedMinutes).toBe(480);
    expect(a.recordedBreakMinutes).toBe(0);
    expect(a.breakShortfallMinutes).toBe(30);
    expect(a.deviations.map((d) => d.code)).toContain("BREAK_MISSING");
  });

  it("distinguishes too short from missing entirely", () => {
    const a = assess(480, [br(240, 255)]);
    expect(a.breakShortfallMinutes).toBe(15);
    expect(a.deviations.map((d) => d.code)).toContain("BREAK_TOO_SHORT");
  });

  it("reports no shortfall under six hours even with no break", () => {
    const a = assess(300);
    expect(a.breakShortfallMinutes).toBe(0);
    expect(a.deviations).toHaveLength(0);
  });

  it("still counts a voluntary break under six hours", () => {
    const a = assess(330, [br(120, 150)]);
    expect(a.recordedBreakMinutes).toBe(30);
    expect(a.workedMinutes).toBe(300);
    expect(a.requiredBreakMinutes).toBe(0);
    expect(a.compliant).toBe(true);
  });
});

describe("six hours at a stretch", () => {
  it("flags an unbroken run longer than six hours", () => {
    // 10h with the break at the very end: the total is compliant, the timing
    // is not. §4 requires the break to interrupt the work, not follow it.
    const a = assess(645, [br(600, 645)]);
    expect(a.longestStretchMinutes).toBe(600);
    expect(a.deviations.map((d) => d.code)).toContain("STRETCH_OVER_6H");
  });

  it("accepts a break placed inside the six hours", () => {
    const a = assess(510, [br(300, 330)]);
    expect(a.longestStretchMinutes).toBe(300);
    expect(a.compliant).toBe(true);
  });

  it("does not flag exactly six hours", () => {
    expect(assess(360).deviations).toHaveLength(0);
  });

  it("measures the longest run, not the first", () => {
    const a = assess(800, [br(60, 90)]);
    expect(a.longestStretchMinutes).toBe(710);
  });
});

describe("edge cases", () => {
  it("handles a day with no time at all", () => {
    const a = assess(0);
    expect(a).toMatchObject({ workedMinutes: 0, requiredBreakMinutes: 0 });
    expect(a.compliant).toBe(true);
  });

  it("ignores a break that ends before it starts", () => {
    const a = assess(480, [br(300, 240)]);
    expect(a.recordedBreakMinutes).toBe(0);
  });

  it("never lets a break exceed the attendance window", () => {
    const a = assess(120, [br(0, 600)]);
    expect(a.recordedBreakMinutes).toBe(120);
    expect(a.workedMinutes).toBe(0);
  });
});
