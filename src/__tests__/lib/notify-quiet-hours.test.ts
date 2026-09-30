/**
 * Quiet hours are the part of push notifications a person actually feels.
 *
 * Getting them wrong is how an app gets its notifications switched off
 * entirely, and a shift worker who has switched them off is exactly the person
 * who then misses a shift change. The line is drawn by URGENCY, not by time
 * alone: something that changes whether you are working tomorrow is worth a
 * late alert, a decision on leave you booked weeks ago is not.
 */
import { describe, it, expect } from "vitest";
import { inQuietHours, type NotifyKind } from "@/lib/notify";

const TZ = "Europe/Berlin";

/** 2026-06-15 at the given Berlin hour (CEST = UTC+2). */
function berlinHour(hour: number): Date {
  return new Date(Date.UTC(2026, 5, 15, hour - 2, 0, 0));
}

describe("urgent events always get through", () => {
  const urgent: NotifyKind[] = [
    "shift.assigned",
    "shift.changed",
    "shift.cancelled",
    "swap.requested",
  ];

  it.each(urgent)("%s is delivered at 23:00", (kind) => {
    // Being told at 23:00 that tomorrow's 06:00 shift moved is the entire
    // reason to allow a late notification.
    expect(inQuietHours(kind, berlinHour(23), TZ)).toBe(false);
  });

  it.each(urgent)("%s is delivered at 03:00", (kind) => {
    expect(inQuietHours(kind, berlinHour(3), TZ)).toBe(false);
  });
});

describe("non-urgent events are held overnight", () => {
  const quiet: NotifyKind[] = [
    "absence.approved",
    "absence.rejected",
    "swap.approved",
  ];

  it.each(quiet)("%s is held at 22:00", (kind) => {
    expect(inQuietHours(kind, berlinHour(22), TZ)).toBe(true);
  });

  it.each(quiet)("%s is held at 05:00", (kind) => {
    expect(inQuietHours(kind, berlinHour(5), TZ)).toBe(true);
  });

  it.each(quiet)("%s is delivered during the day", (kind) => {
    expect(inQuietHours(kind, berlinHour(9), TZ)).toBe(false);
    expect(inQuietHours(kind, berlinHour(17), TZ)).toBe(false);
  });
});

describe("quiet-hours boundaries", () => {
  it("starts at 21:00 and ends at 07:00", () => {
    expect(inQuietHours("absence.approved", berlinHour(20), TZ)).toBe(false);
    expect(inQuietHours("absence.approved", berlinHour(21), TZ)).toBe(true);
    expect(inQuietHours("absence.approved", berlinHour(6), TZ)).toBe(true);
    expect(inQuietHours("absence.approved", berlinHour(7), TZ)).toBe(false);
  });

  it("is evaluated in the given zone, not the server's", () => {
    // 21:00 in Berlin is 20:00 in London: quiet for one, not the other. A
    // server in UTC must not decide this for everybody.
    const at = berlinHour(21);
    expect(inQuietHours("absence.approved", at, "Europe/Berlin")).toBe(true);
    expect(inQuietHours("absence.approved", at, "Europe/London")).toBe(false);
  });

  it("delivers rather than silences when the zone is unusable", () => {
    // A bad timezone string must not swallow a notification: failing open is
    // the right direction when the alternative is silence.
    expect(inQuietHours("absence.approved", berlinHour(23), "Not/AZone")).toBe(
      false,
    );
  });
});
