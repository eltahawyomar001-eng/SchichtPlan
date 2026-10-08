/**
 * Lateness bands and wording. The sentence is specified copy, so it is pinned
 * exactly rather than matched loosely.
 */
import { describe, it, expect } from "vitest";
import { assessLateness, severityForMinutes } from "@/lib/lateness";

describe("the bands", () => {
  it("leaves an on-time arrival unmarked", () => {
    const l = assessLateness("08:00", "08:00");
    expect(l.severity).toBe("NONE");
    expect(l.minutes).toBe(0);
    expect(l.requiresReason).toBe(false);
  });

  it("treats arriving early as on time, never negative", () => {
    const l = assessLateness("08:00", "07:45");
    expect(l.minutes).toBe(0);
    expect(l.severity).toBe("NONE");
  });

  it.each([
    [1, "YELLOW"],
    [15, "YELLOW"],
    [16, "ORANGE"],
    [45, "ORANGE"],
    [46, "RED"],
    [240, "RED"],
  ])("puts %i minutes in %s", (minutes, expected) => {
    expect(severityForMinutes(minutes)).toBe(expected);
  });

  it("closes each band at the top so nothing falls between two", () => {
    // The boundaries are where a band definition usually goes wrong.
    expect(severityForMinutes(15)).toBe("YELLOW");
    expect(severityForMinutes(15.5)).toBe("ORANGE");
    expect(severityForMinutes(45)).toBe("ORANGE");
    expect(severityForMinutes(45.5)).toBe("RED");
  });
});

describe("the message", () => {
  it("reads exactly as specified", () => {
    expect(assessLateness("08:00", "08:12").message).toBe(
      "Geplanter Schichtbeginn: 08:00 Uhr. Eingestempelt: 08:12 Uhr. Verspätung: 12 Minuten.",
    );
  });

  it("uses the singular for one minute", () => {
    expect(assessLateness("08:00", "08:01").message).toContain(
      "Verspätung: 1 Minute.",
    );
  });

  it("names planned and actual even when on time", () => {
    const l = assessLateness("06:00", "05:58");
    expect(l.message).toContain("Geplanter Schichtbeginn: 06:00 Uhr");
    expect(l.message).toContain("Eingestempelt: 05:58 Uhr");
  });
});

describe("a justification is always required when late", () => {
  it("requires one even for a single minute", () => {
    // However small: the spec ties the obligation to being late at all, not
    // to a threshold.
    expect(assessLateness("08:00", "08:01").requiresReason).toBe(true);
  });

  it("requires none when on time", () => {
    expect(assessLateness("08:00", "08:00").requiresReason).toBe(false);
  });
});

describe("shifts around midnight", () => {
  it("reads a clock-in just before a post-midnight start as early", () => {
    // 23:55 against a 00:05 start is ten minutes early, not 23h50 late.
    const l = assessLateness("00:05", "23:55");
    expect(l.minutes).toBe(0);
    expect(l.severity).toBe("NONE");
  });

  it("still reports genuine lateness on a night shift", () => {
    const l = assessLateness("22:00", "22:20");
    expect(l.minutes).toBe(20);
    expect(l.severity).toBe("ORANGE");
  });

  it("handles a late clock-in that crosses midnight", () => {
    const l = assessLateness("23:50", "00:10");
    expect(l.minutes).toBe(20);
  });
});
