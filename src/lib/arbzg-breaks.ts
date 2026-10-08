/**
 * ArbZG §4 applied to RECORDED time, not planned shifts.
 *
 * arbzg.ts already answers "may this shift be scheduled?". This answers the
 * different question "what actually happened, and does it comply?" — and the
 * two must not be conflated. A roster can be lawful and the day still breach
 * §4 because somebody skipped their break.
 *
 * The rule (§4 ArbZG), on working time, i.e. attendance MINUS breaks:
 *   ≤ 6h          → no statutory break
 *   > 6h to ≤ 9h  → at least 30 minutes
 *   > 9h          → at least 45 minutes
 *
 * The 45-minute step starts above NINE hours, not ten. That is the mistake
 * worth guarding against: ten is the §3 ceiling on daily working time and is
 * easy to carry over into §4 by accident, which would under-report the
 * requirement for everyone working between nine and ten hours.
 *
 * Two things this deliberately does NOT do:
 *
 * - It never deducts a break that was not taken. Subtracting the statutory
 *   minimum from a day where nobody paused produces a tidy number that is a
 *   false record of working time, and it hides the very breach the law wants
 *   surfaced. A shortfall is reported as a deviation for a human to resolve.
 * - It never counts a break twice. Only the breaks passed in are subtracted,
 *   and the statutory minimum is a threshold to compare against, never a
 *   second subtraction on top of them.
 */
import { requiredBreakForNet } from "@/lib/arbzg";

/** A break that actually happened, as offsets in minutes from clock-in. */
export interface RecordedBreak {
  startOffsetMinutes: number;
  endOffsetMinutes: number;
}

export type BreakDeviationCode =
  /** Statutory break required, none recorded at all. */
  | "BREAK_MISSING"
  /** Some break recorded, but less than §4 requires. */
  | "BREAK_TOO_SHORT"
  /** Worked more than six hours at a stretch without pausing (§4 sentence 2). */
  | "STRETCH_OVER_6H";

export interface BreakDeviation {
  code: BreakDeviationCode;
  /** Minutes still owed. Zero for a stretch finding, which is about timing. */
  shortfallMinutes: number;
  message: string;
  messageEn: string;
}

export interface BreakAssessment {
  /** Clock-in to clock-out, including breaks. */
  grossMinutes: number;
  /** Sum of the breaks actually recorded, overlaps counted once. */
  recordedBreakMinutes: number;
  /** Working time in the sense of §4: attendance minus recorded breaks. */
  workedMinutes: number;
  /** What §4 demands for that working time. */
  requiredBreakMinutes: number;
  /** How much of the requirement is unmet. Zero when compliant. */
  breakShortfallMinutes: number;
  /** Longest unbroken run of work, which §4 caps at six hours. */
  longestStretchMinutes: number;
  deviations: BreakDeviation[];
  /** True when nothing needs a manager's attention. */
  compliant: boolean;
}

const SIX_HOURS = 6 * 60;

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`;
}

/**
 * Total break time, with overlaps counted once.
 *
 * Overlapping rows are not hypothetical: a live-clock pause and a manually
 * corrected one can cover the same minutes, and adding them up would credit an
 * employee with more rest than they took and could mask a real shortfall.
 */
function mergedBreakMinutes(breaks: RecordedBreak[]): {
  total: number;
  merged: RecordedBreak[];
} {
  const valid = breaks
    .filter((b) => b.endOffsetMinutes > b.startOffsetMinutes)
    .sort((a, b) => a.startOffsetMinutes - b.startOffsetMinutes);

  const merged: RecordedBreak[] = [];
  for (const b of valid) {
    const last = merged[merged.length - 1];
    if (last && b.startOffsetMinutes <= last.endOffsetMinutes) {
      last.endOffsetMinutes = Math.max(
        last.endOffsetMinutes,
        b.endOffsetMinutes,
      );
    } else {
      merged.push({ ...b });
    }
  }
  return {
    total: merged.reduce(
      (s, b) => s + (b.endOffsetMinutes - b.startOffsetMinutes),
      0,
    ),
    merged,
  };
}

/** Longest run of work between clock-in, the breaks, and clock-out. */
function longestStretch(grossMinutes: number, merged: RecordedBreak[]): number {
  let longest = 0;
  let cursor = 0;
  for (const b of merged) {
    const start = Math.max(0, Math.min(b.startOffsetMinutes, grossMinutes));
    longest = Math.max(longest, start - cursor);
    cursor = Math.max(cursor, Math.min(b.endOffsetMinutes, grossMinutes));
  }
  return Math.max(longest, grossMinutes - cursor);
}

/**
 * Assess one recorded working day against §4.
 *
 * `breaks` must contain only breaks that were actually taken — recorded by the
 * employee or confirmed by a manager. Filtering unconfirmed rows is the
 * caller's job, because only the caller knows what "confirmed" means in its
 * context, and quietly counting a pending correction as rest would be the
 * worst kind of wrong answer here.
 */
export function assessRecordedBreaks(input: {
  grossMinutes: number;
  breaks: RecordedBreak[];
}): BreakAssessment {
  const grossMinutes = Math.max(0, Math.round(input.grossMinutes));
  const { total, merged } = mergedBreakMinutes(input.breaks ?? []);
  const recordedBreakMinutes = Math.min(total, grossMinutes);
  const workedMinutes = Math.max(0, grossMinutes - recordedBreakMinutes);

  const requiredBreakMinutes = requiredBreakForNet(workedMinutes);
  const breakShortfallMinutes = Math.max(
    0,
    requiredBreakMinutes - recordedBreakMinutes,
  );
  const longestStretchMinutes = longestStretch(grossMinutes, merged);

  const deviations: BreakDeviation[] = [];

  if (breakShortfallMinutes > 0) {
    const threshold = requiredBreakMinutes === 45 ? 9 : 6;
    deviations.push({
      code: recordedBreakMinutes === 0 ? "BREAK_MISSING" : "BREAK_TOO_SHORT",
      shortfallMinutes: breakShortfallMinutes,
      message:
        `ArbZG §4: Bei einer Arbeitszeit von ${fmt(workedMinutes)} ` +
        `(über ${threshold} Stunden) sind mindestens ${requiredBreakMinutes} Minuten ` +
        `Pause vorgeschrieben. Erfasst sind ${recordedBreakMinutes} Minuten, ` +
        `es fehlen ${breakShortfallMinutes} Minuten.`,
      messageEn:
        `ArbZG §4: A working time of ${workedMinutes} minutes (over ${threshold} ` +
        `hours) requires at least ${requiredBreakMinutes} minutes of break. ` +
        `${recordedBreakMinutes} minutes were recorded, ` +
        `${breakShortfallMinutes} are missing.`,
    });
  }

  if (longestStretchMinutes > SIX_HOURS) {
    deviations.push({
      code: "STRETCH_OVER_6H",
      shortfallMinutes: 0,
      message:
        `ArbZG §4: Es wurde ${fmt(longestStretchMinutes)} am Stück ohne ` +
        `Ruhepause gearbeitet. Nach spätestens 6 Stunden ist eine Pause ` +
        `erforderlich.`,
      messageEn:
        `ArbZG §4: ${longestStretchMinutes} minutes were worked without a ` +
        `break. A break is due after six hours at the latest.`,
    });
  }

  return {
    grossMinutes,
    recordedBreakMinutes,
    workedMinutes,
    requiredBreakMinutes,
    breakShortfallMinutes,
    longestStretchMinutes,
    deviations,
    compliant: deviations.length === 0,
  };
}
