/**
 * Elapsed minutes between two wall-clock times on a shift.
 *
 * `end - start` on minutes-of-day is wrong the moment a shift crosses
 * midnight, and it fails silently in the worst possible direction: a break
 * from 23:50 to 00:20 computes as 20 - 1430 = -1410, which the old code
 * clamped with Math.max(0, ...) to ZERO. A real thirty-minute break was
 * recorded as no break at all -- inflating paid time and making the ArbZG
 * record claim a rest that the data says never happened.
 *
 * The clamp is what made it invisible. A negative duration is obviously a bug;
 * a zero looks like somebody simply did not pause.
 *
 * A segment of a single shift never reaches 24 hours -- ArbZG §3 caps the day
 * at ten -- so an end before its start can only mean the clock wrapped past
 * midnight. That is the same assumption shiftGrossMinutes already makes for
 * overnight shifts, kept consistent here.
 *
 * Known limit, stated rather than hidden: these are naked clock strings, so a
 * segment spanning a DST transition is out by the offset change. Fixing that
 * needs stored instants, not an arithmetic change -- `breakStart` is a "HH:MM"
 * string and carries no date. Recorded here so the next person does not
 * mistake this for a complete timezone fix.
 */

/** Minutes since midnight for "HH:MM". */
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Elapsed minutes from `start` to `end`, wrapping once past midnight.
 *
 * Returns 0 only when the two times are genuinely equal, never as the result
 * of a negative difference being clamped away.
 */
export function minutesBetweenClockTimes(start: string, end: string): number {
  const s = clockToMinutes(start);
  const e = clockToMinutes(end);
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  const diff = e - s;
  // Equal times are a zero-length segment; anything else that looks negative
  // crossed midnight.
  return diff < 0 ? diff + 24 * 60 : diff;
}
