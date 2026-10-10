/**
 * Durations across midnight.
 *
 * The bug this replaces lost real break time: `end - start` went negative past
 * midnight and a Math.max(0, ...) clamp turned it into zero, so a thirty-minute
 * break was recorded as none. These tests pin the wrap and, just as important,
 * that a zero result only ever means a zero-length segment.
 */
import { describe, it, expect } from "vitest";
import { minutesBetweenClockTimes, clockToMinutes } from "@/lib/clock-duration";

describe("within one day", () => {
  it("measures an ordinary break", () => {
    expect(minutesBetweenClockTimes("12:00", "12:30")).toBe(30);
  });

  it("measures a full shift", () => {
    expect(minutesBetweenClockTimes("08:00", "16:30")).toBe(510);
  });

  it("returns zero only for equal times", () => {
    expect(minutesBetweenClockTimes("12:00", "12:00")).toBe(0);
  });
});

describe("across midnight", () => {
  it("measures the break that used to vanish", () => {
    // 23:50 -> 00:20 produced 20 - 1430 = -1410, clamped to 0.
    expect(minutesBetweenClockTimes("23:50", "00:20")).toBe(30);
  });

  it("measures a night shift", () => {
    expect(minutesBetweenClockTimes("22:00", "06:00")).toBe(480);
  });

  it("handles a break starting exactly at midnight", () => {
    expect(minutesBetweenClockTimes("00:00", "00:30")).toBe(30);
  });

  it("handles a break ending exactly at midnight", () => {
    expect(minutesBetweenClockTimes("23:30", "00:00")).toBe(30);
  });

  it("handles one minute either side of midnight", () => {
    expect(minutesBetweenClockTimes("23:59", "00:01")).toBe(2);
  });
});

describe("never silently clamps", () => {
  it("does not report zero for a wrapped segment", () => {
    // The whole point: the old clamp made a real break indistinguishable from
    // no break at all.
    for (const [s, e] of [
      ["23:00", "01:00"],
      ["23:45", "00:15"],
      ["22:30", "00:00"],
    ] as const) {
      expect(minutesBetweenClockTimes(s, e)).toBeGreaterThan(0);
    }
  });

  it("treats malformed input as zero rather than NaN", () => {
    // NaN would propagate into stored minutes and corrupt the record silently.
    expect(minutesBetweenClockTimes("", "12:00")).toBe(0);
    expect(minutesBetweenClockTimes("12:00", "nonsense")).toBe(0);
  });
});

describe("clockToMinutes", () => {
  it("parses midnight and the last minute of the day", () => {
    expect(clockToMinutes("00:00")).toBe(0);
    expect(clockToMinutes("23:59")).toBe(1439);
  });
});

/**
 * Preferring the stored instant.
 *
 * Clock strings cannot survive a DST transition: the wall clock jumps an hour
 * and minute arithmetic silently gains or loses it. An instant is unambiguous.
 */
describe("breakDurationMinutes", () => {
  it("uses the instant when one was stored", async () => {
    const { breakDurationMinutes } = await import("@/lib/clock-duration");
    const r = breakDurationMinutes({
      breakStartAt: new Date("2026-10-09T12:00:00Z"),
      breakStart: "14:00",
      endAt: new Date("2026-10-09T12:30:00Z"),
      endClock: "14:30",
    });
    expect(r).toEqual({ minutes: 30, exact: true });
  });

  it("is correct across a DST transition, where clock strings are not", async () => {
    const { breakDurationMinutes, minutesBetweenClockTimes } =
      await import("@/lib/clock-duration");
    // Europe/Berlin, 2027-03-28: 02:00 local jumps to 03:00. A break from
    // 01:45 to 03:15 local is 45 real minutes, but the clock strings say 90.
    const r = breakDurationMinutes({
      breakStartAt: new Date("2027-03-28T00:45:00Z"),
      breakStart: "01:45",
      endAt: new Date("2027-03-28T01:30:00Z"),
      endClock: "03:15",
    });
    expect(r.minutes).toBe(45);
    expect(r.exact).toBe(true);
    // What the string path would have claimed, for contrast.
    expect(minutesBetweenClockTimes("01:45", "03:15")).toBe(90);
  });

  it("falls back to clock strings for entries predating the column", async () => {
    const { breakDurationMinutes } = await import("@/lib/clock-duration");
    const r = breakDurationMinutes({
      breakStartAt: null,
      breakStart: "23:50",
      endAt: new Date("2026-10-10T00:20:00Z"),
      endClock: "00:20",
    });
    // Still wraps correctly; simply not certified exact.
    expect(r).toEqual({ minutes: 30, exact: false });
  });

  it("ignores an instant that would yield a negative span", async () => {
    // Clock skew or a bad write must not record a negative break.
    const { breakDurationMinutes } = await import("@/lib/clock-duration");
    const r = breakDurationMinutes({
      breakStartAt: new Date("2026-10-09T13:00:00Z"),
      breakStart: "12:00",
      endAt: new Date("2026-10-09T12:30:00Z"),
      endClock: "12:30",
    });
    expect(r).toEqual({ minutes: 30, exact: false });
  });
});
