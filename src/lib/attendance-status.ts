/**
 * Who is actually working right now, measured against the plan.
 *
 * The admin question this answers is not "who is clocked in" but "does what I
 * am seeing match what I rostered". Those differ in the case that matters: an
 * employee clocked in with no shift, or hours outside the one they were given,
 * is the situation a manager has to notice the same day. By the time it shows
 * up in a monthly export it is an argument about memory.
 *
 * Four states, deliberately. A single "working" bucket hides the deviation,
 * which is the only one of the four that needs a decision.
 */

/** HH:MM, as shifts store it. */
type TimeString = string;

export type AttendanceStatus =
  /** Clocked in, inside a shift they were rostered for. */
  | "PLANMAESSIG"
  /** Clocked in, currently on a break. */
  | "PAUSE"
  /** Clocked in with no matching shift, or outside the one they have. */
  | "UNPLANMAESSIG"
  /** Not clocked in. */
  | "OFFLINE";

/**
 * Why an attendance was judged unplanned.
 *
 * Carried separately from the status because "no shift at all" and "started
 * three hours early" are different conversations, and an admin deciding
 * whether to approve needs to know which one they are having.
 */
export type DeviationReason =
  /** No shift rostered for this employee that day. */
  | "NO_SHIFT"
  /** Clocked in further before the start than tolerance allows. */
  | "EARLY"
  /** Clocked in after the shift had already ended. */
  | "LATE"
  /** Still clocked in well past the end of the shift. */
  | "OVERRUN";

/**
 * How far from the plan still counts as following it.
 *
 * Separate values for the two directions on purpose. Arriving a few minutes
 * early is normal and should not raise anything; staying on well past the end
 * is the thing a manager wants to see, and it accumulates differently.
 */
export interface AttendanceTolerance {
  /** Minutes before the shift start that still count as planned. */
  startMinutes: number;
  /** Minutes past the shift end before an ongoing entry counts as deviating. */
  overrunMinutes: number;
}

export const DEFAULT_TOLERANCE: AttendanceTolerance = {
  // Fifteen minutes either side of the roster is the usual grace in German
  // Zeiterfassung and matches what most works agreements assume.
  startMinutes: 15,
  overrunMinutes: 30,
};

export interface PlannedShift {
  id: string;
  /** The calendar day the shift belongs to. */
  date: Date;
  startTime: TimeString;
  endTime: TimeString;
  locationName?: string | null;
}

export interface OpenEntry {
  id: string;
  clockInAt: Date;
  /** Set while a break is running and not yet ended. */
  breakStart?: Date | null;
  breakEnd?: Date | null;
}

export interface AttendanceResult {
  status: AttendanceStatus;
  /** The shift the clock-in was matched to, when one was found. */
  matchedShiftId: string | null;
  reason: DeviationReason | null;
  /**
   * How far outside the plan, in minutes. Always positive; `reason` says in
   * which direction. Null when the attendance is planned or there is none.
   */
  deviationMinutes: number | null;
}

/**
 * A break's start and end as instants.
 *
 * TimeEntry stores these as "HH:MM" strings, not timestamps, so they have to
 * be anchored to the entry's own date. Passing the raw string to `new Date`
 * yields Invalid Date, and every comparison against it is silently false --
 * which would report somebody on a break as being at their post.
 */
export function breakInstants(
  date: Date,
  breakStart?: string | null,
  breakEnd?: string | null,
): { breakStart: Date | null; breakEnd: Date | null } {
  return {
    breakStart: breakStart ? shiftInstant(date, breakStart) : null,
    breakEnd: breakEnd ? shiftInstant(date, breakEnd) : null,
  };
}

/** "HH:MM" on a given day, as an absolute instant. */
export function shiftInstant(date: Date, time: TimeString): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

/**
 * Start and end of a shift as instants.
 *
 * An end that is not after the start means the shift crosses midnight, so the
 * end belongs to the following day. Reading those literally would make every
 * night shift look like a shift that ended before it began, and every night
 * worker permanently unplanned.
 */
export function shiftWindow(shift: PlannedShift): { start: Date; end: Date } {
  const start = shiftInstant(shift.date, shift.startTime);
  let end = shiftInstant(shift.date, shift.endTime);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

const MIN = 60 * 1000;

/**
 * Classify one employee's current attendance.
 *
 * `shifts` should be the shifts that could plausibly cover now: the current
 * day and the one before it, so a night shift started yesterday still matches.
 */
export function classifyAttendance(input: {
  entry: OpenEntry | null;
  shifts: PlannedShift[];
  now: Date;
  tolerance?: AttendanceTolerance;
}): AttendanceResult {
  const tol = input.tolerance ?? DEFAULT_TOLERANCE;
  const { entry, shifts, now } = input;

  if (!entry) {
    return {
      status: "OFFLINE",
      matchedShiftId: null,
      reason: null,
      deviationMinutes: null,
    };
  }

  // A break is reported as a break whatever the plan says. The question
  // "is this person at their post right now" has one answer, and the
  // deviation, if any, is still there when they come back.
  const onBreak = Boolean(entry.breakStart && !entry.breakEnd);

  const windows = shifts.map((s) => ({ shift: s, ...shiftWindow(s) }));

  // The shift whose window contains the clock-in, allowing the early grace.
  const matched = windows.find(
    ({ start, end }) =>
      entry.clockInAt >= new Date(start.getTime() - tol.startMinutes * MIN) &&
      entry.clockInAt <= end,
  );

  if (matched) {
    const overrunBy = Math.floor((now.getTime() - matched.end.getTime()) / MIN);
    if (overrunBy > tol.overrunMinutes) {
      return {
        status: onBreak ? "PAUSE" : "UNPLANMAESSIG",
        matchedShiftId: matched.shift.id,
        reason: "OVERRUN",
        deviationMinutes: overrunBy,
      };
    }
    return {
      status: onBreak ? "PAUSE" : "PLANMAESSIG",
      matchedShiftId: matched.shift.id,
      reason: null,
      deviationMinutes: null,
    };
  }

  // Clocked in, but nothing matched. Say which way it missed, using the
  // nearest shift of the day -- that is what the admin will ask about.
  if (windows.length === 0) {
    return {
      status: onBreak ? "PAUSE" : "UNPLANMAESSIG",
      matchedShiftId: null,
      reason: "NO_SHIFT",
      deviationMinutes: null,
    };
  }

  let nearest = windows[0];
  let best = Infinity;
  for (const w of windows) {
    const d = Math.min(
      Math.abs(entry.clockInAt.getTime() - w.start.getTime()),
      Math.abs(entry.clockInAt.getTime() - w.end.getTime()),
    );
    if (d < best) {
      best = d;
      nearest = w;
    }
  }
  const early = entry.clockInAt < nearest.start;
  return {
    status: onBreak ? "PAUSE" : "UNPLANMAESSIG",
    matchedShiftId: null,
    reason: early ? "EARLY" : "LATE",
    deviationMinutes: Math.floor(
      Math.abs(
        entry.clockInAt.getTime() -
          (early ? nearest.start.getTime() : nearest.end.getTime()),
      ) / MIN,
    ),
  };
}

/** Counts per status, for the summary row above the list. */
export function summarise(
  results: AttendanceResult[],
): Record<AttendanceStatus, number> {
  const out: Record<AttendanceStatus, number> = {
    PLANMAESSIG: 0,
    PAUSE: 0,
    UNPLANMAESSIG: 0,
    OFFLINE: 0,
  };
  for (const r of results) out[r.status]++;
  return out;
}
