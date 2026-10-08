/**
 * Measuring attendance against the roster.
 *
 * Each case here is a situation an admin has to act on the same day, and the
 * classification is the only thing that surfaces it. Getting one wrong either
 * raises an alarm about somebody who arrived four minutes early, or stays
 * quiet about somebody working a shift nobody rostered.
 */
import { describe, it, expect } from "vitest";
import {
  classifyAttendance,
  shiftWindow,
  summarise,
  DEFAULT_TOLERANCE,
  type PlannedShift,
} from "@/lib/attendance-status";

const DAY = new Date(2026, 9, 8);
const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0, 0);

const shift = (over: Partial<PlannedShift> = {}): PlannedShift => ({
  id: "sh_1",
  date: DAY,
  startTime: "08:00",
  endTime: "16:00",
  ...over,
});

const run = (
  entry: {
    clockInAt: Date;
    breakStart?: Date | null;
    breakEnd?: Date | null;
  } | null,
  shifts: PlannedShift[],
  now: Date,
) =>
  classifyAttendance({
    entry: entry ? { id: "te_1", ...entry } : null,
    shifts,
    now,
  });

describe("offline", () => {
  it("reports no entry as offline", () => {
    const r = run(null, [shift()], at(10));
    expect(r.status).toBe("OFFLINE");
    expect(r.reason).toBeNull();
  });

  it("is offline even when a shift is running", () => {
    // The requirement asks who is NOT clocked in, not who is missing. A
    // separate "should be here" signal would be a different feature.
    expect(run(null, [shift()], at(10)).status).toBe("OFFLINE");
  });
});

describe("planned attendance", () => {
  it("matches a clock-in inside the shift", () => {
    const r = run({ clockInAt: at(8) }, [shift()], at(10));
    expect(r.status).toBe("PLANMAESSIG");
    expect(r.matchedShiftId).toBe("sh_1");
    expect(r.deviationMinutes).toBeNull();
  });

  it("allows arriving a little early", () => {
    // Fifteen minutes is the usual grace; flagging it would make the whole
    // view noise on any site where people arrive before their start.
    const r = run({ clockInAt: at(7, 50) }, [shift()], at(10));
    expect(r.status).toBe("PLANMAESSIG");
  });

  it("allows arriving exactly at the edge of tolerance", () => {
    const r = run({ clockInAt: at(7, 45) }, [shift()], at(10));
    expect(r.status).toBe("PLANMAESSIG");
  });

  it("still counts as planned shortly after the end", () => {
    // Someone finishing up is not a deviation worth a decision.
    const r = run({ clockInAt: at(8) }, [shift()], at(16, 20));
    expect(r.status).toBe("PLANMAESSIG");
  });
});

describe("unplanned attendance", () => {
  it("flags a clock-in with no shift at all", () => {
    const r = run({ clockInAt: at(9) }, [], at(10));
    expect(r.status).toBe("UNPLANMAESSIG");
    expect(r.reason).toBe("NO_SHIFT");
    expect(r.matchedShiftId).toBeNull();
  });

  it("flags arriving well before the shift", () => {
    const r = run({ clockInAt: at(5) }, [shift()], at(6));
    expect(r.status).toBe("UNPLANMAESSIG");
    expect(r.reason).toBe("EARLY");
    expect(r.deviationMinutes).toBe(180);
  });

  it("flags starting after the shift had ended", () => {
    const r = run({ clockInAt: at(18) }, [shift()], at(19));
    expect(r.status).toBe("UNPLANMAESSIG");
    expect(r.reason).toBe("LATE");
    expect(r.deviationMinutes).toBe(120);
  });

  it("flags still being clocked in long past the end", () => {
    // Working on past the roster is the deviation that costs money and the
    // one most likely to go unnoticed until payroll.
    const r = run({ clockInAt: at(8) }, [shift()], at(18));
    expect(r.status).toBe("UNPLANMAESSIG");
    expect(r.reason).toBe("OVERRUN");
    expect(r.deviationMinutes).toBe(120);
  });

  it("names the nearest shift when several exist", () => {
    const r = run(
      { clockInAt: at(20) },
      [shift(), shift({ id: "sh_2", startTime: "12:00", endTime: "18:00" })],
      at(21),
    );
    expect(r.reason).toBe("LATE");
    expect(r.deviationMinutes).toBe(120);
  });
});

describe("breaks", () => {
  it("reports a running break as a break", () => {
    const r = run(
      { clockInAt: at(8), breakStart: at(12) },
      [shift()],
      at(12, 20),
    );
    expect(r.status).toBe("PAUSE");
  });

  it("goes back to planned once the break has ended", () => {
    const r = run(
      { clockInAt: at(8), breakStart: at(12), breakEnd: at(12, 30) },
      [shift()],
      at(13),
    );
    expect(r.status).toBe("PLANMAESSIG");
  });

  it("keeps the deviation visible while on a break", () => {
    // The status answers "are they at their post right now". The deviation is
    // still recorded, and is still there when they come back.
    const r = run({ clockInAt: at(9), breakStart: at(12) }, [], at(12, 10));
    expect(r.status).toBe("PAUSE");
    expect(r.reason).toBe("NO_SHIFT");
  });
});

describe("night shifts", () => {
  it("treats an end before the start as the next day", () => {
    // Read literally, a 22:00-06:00 shift ends eight hours before it begins,
    // and every night worker is permanently unplanned.
    const w = shiftWindow(shift({ startTime: "22:00", endTime: "06:00" }));
    expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
    expect(w.end.getDate()).toBe(9);
  });

  it("counts a night clock-in as planned", () => {
    const night = shift({ startTime: "22:00", endTime: "06:00" });
    const r = run({ clockInAt: at(22) }, [night], new Date(2026, 9, 9, 2));
    expect(r.status).toBe("PLANMAESSIG");
  });

  it("counts the small hours of a night shift as planned", () => {
    const night = shift({ startTime: "22:00", endTime: "06:00" });
    const r = classifyAttendance({
      entry: { id: "te", clockInAt: new Date(2026, 9, 8, 22, 5) },
      shifts: [night],
      now: new Date(2026, 9, 9, 5, 30),
    });
    expect(r.status).toBe("PLANMAESSIG");
  });
});

describe("tolerance", () => {
  it("is configurable", () => {
    // A works agreement can set its own grace, and the default should not be
    // baked into the judgement.
    const strict = classifyAttendance({
      entry: { id: "te", clockInAt: at(7, 50) },
      shifts: [shift()],
      now: at(10),
      tolerance: { startMinutes: 5, overrunMinutes: 30 },
    });
    expect(strict.status).toBe("UNPLANMAESSIG");
    expect(strict.reason).toBe("EARLY");
  });

  it("has sane defaults", () => {
    expect(DEFAULT_TOLERANCE.startMinutes).toBe(15);
    expect(DEFAULT_TOLERANCE.overrunMinutes).toBe(30);
  });
});

describe("summarise", () => {
  it("counts every status, including the empty ones", () => {
    // The summary row must show a zero rather than omit the bucket, or an
    // admin cannot tell "none unplanned" from "not measured".
    const s = summarise([
      {
        status: "PLANMAESSIG",
        matchedShiftId: "a",
        reason: null,
        deviationMinutes: null,
      },
      {
        status: "PAUSE",
        matchedShiftId: "a",
        reason: null,
        deviationMinutes: null,
      },
      {
        status: "PAUSE",
        matchedShiftId: "a",
        reason: null,
        deviationMinutes: null,
      },
    ]);
    expect(s).toEqual({
      PLANMAESSIG: 1,
      PAUSE: 2,
      UNPLANMAESSIG: 0,
      OFFLINE: 0,
    });
  });
});
