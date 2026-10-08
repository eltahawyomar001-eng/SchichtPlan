/**
 * Turn a stored time entry into the deviations a manager has to see.
 *
 * The domain rules live in arbzg-breaks.ts and lateness.ts and know nothing
 * about the database. This is the bridge, and it carries the two awkward facts
 * about how a day is actually stored:
 *
 * - breakStart/breakEnd are "HH:MM" STRINGS, not timestamps. `new Date("12:30")`
 *   is an Invalid Date, and arithmetic on it silently produces NaN minutes,
 *   which would read as a compliant day with no break at all.
 * - A day may have no TimeEntryBreak rows. Those entries are not broken: the
 *   legacy single breakStart/breakEnd pair is still the truth for them, and
 *   must keep being read that way or every historical record would suddenly
 *   look like a §4 breach.
 */
import {
  assessRecordedBreaks,
  type BreakAssessment,
  type RecordedBreak,
} from "@/lib/arbzg-breaks";
import { assessLateness, type Lateness } from "@/lib/lateness";
import { shiftGrossMinutes } from "@/lib/arbzg";

/** The stored shape this reads. Deliberately structural, not a Prisma type. */
export interface AssessableEntry {
  startTime: string;
  endTime: string;
  /** Legacy single break, "HH:MM". Used only when `breaks` is empty. */
  breakStart?: string | null;
  breakEnd?: string | null;
  /** Legacy total, used when the pair is absent but a total was recorded. */
  breakMinutes?: number | null;
  /** Modern rows. Unconfirmed ones are ignored: a claim is not rest. */
  breaks?: {
    startOffsetMinutes: number;
    endOffsetMinutes: number;
    confirmed: boolean;
  }[];
  latenessReason?: string | null;
}

export interface EntryAssessment {
  lateness: Lateness | null;
  breaks: BreakAssessment;
  /** Late, but nobody has said why yet. */
  latenessReasonMissing: boolean;
  /** Everything a manager would need to act on, in one list. */
  deviationCodes: string[];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Offsets from the start of the attendance window.
 *
 * A break on an overnight shift can carry a smaller "HH:MM" than the start
 * (23:30 → 00:10), so the offset wraps forward a day rather than going
 * negative and being discarded as invalid.
 */
function offsetFromStart(startTime: string, hhmm: string): number {
  let diff = toMinutes(hhmm) - toMinutes(startTime);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function resolveBreaks(entry: AssessableEntry): RecordedBreak[] {
  const confirmed = (entry.breaks ?? []).filter((b) => b.confirmed);
  if (confirmed.length > 0) {
    return confirmed.map((b) => ({
      startOffsetMinutes: b.startOffsetMinutes,
      endOffsetMinutes: b.endOffsetMinutes,
    }));
  }

  // Legacy pair: a real window, so the six-hour-stretch check still works.
  if (entry.breakStart && entry.breakEnd) {
    const start = offsetFromStart(entry.startTime, entry.breakStart);
    const end = offsetFromStart(entry.startTime, entry.breakEnd);
    if (end > start)
      return [{ startOffsetMinutes: start, endOffsetMinutes: end }];
  }

  // Only a total survives. Its timing is unknown, so it is placed in the
  // middle of the day: the alternative is to pretend it fell at one end, which
  // would invent a six-hour-stretch breach or invent compliance. The middle
  // asserts nothing either way.
  const total = entry.breakMinutes ?? 0;
  if (total > 0) {
    const gross = shiftGrossMinutes(entry.startTime, entry.endTime);
    const start = Math.max(0, Math.floor((gross - total) / 2));
    return [{ startOffsetMinutes: start, endOffsetMinutes: start + total }];
  }

  return [];
}

/**
 * Assess one entry. `plannedStart` is the rostered shift start, "HH:MM";
 * omit it when the entry has no shift, which makes lateness meaningless rather
 * than zero.
 */
export function assessEntry(
  entry: AssessableEntry,
  plannedStart?: string | null,
): EntryAssessment {
  const breaks = assessRecordedBreaks({
    grossMinutes: shiftGrossMinutes(entry.startTime, entry.endTime),
    breaks: resolveBreaks(entry),
  });

  const lateness = plannedStart
    ? assessLateness(plannedStart, entry.startTime)
    : null;

  const latenessReasonMissing = Boolean(
    lateness?.requiresReason && !entry.latenessReason?.trim(),
  );

  return {
    lateness,
    breaks,
    latenessReasonMissing,
    deviationCodes: [
      ...breaks.deviations.map((d) => d.code),
      ...(latenessReasonMissing ? ["LATENESS_REASON_MISSING"] : []),
      ...(lateness && lateness.minutes > 0 ? ["LATE"] : []),
    ],
  };
}

/** The status German managers see for a late entry with no explanation. */
export const LATENESS_REASON_MISSING_LABEL = "Begründung der Verspätung fehlt";
