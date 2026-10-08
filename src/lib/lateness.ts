/**
 * Lateness against the planned shift start.
 *
 * The recorded clock-in time is evidence and is never touched by any of this.
 * Everything here is a derived label laid over it: the moment a highlight is
 * allowed to round, shift or "tidy" the stamped time, the record stops being
 * an honest one, and that record is what a Zoll audit or a wage dispute turns
 * on.
 *
 * The bands are a product decision, not statute, so they live here as data
 * rather than scattered through the UI:
 *   on time        → no marking at all
 *   > 0 to ≤ 15m   → yellow
 *   > 15 to ≤ 45m  → orange
 *   > 45m          → red
 * They are contiguous and closed at the top, so no duration falls between two
 * bands or lands in both.
 */

export type LatenessSeverity = "NONE" | "YELLOW" | "ORANGE" | "RED";

export interface Lateness {
  /** Whole minutes late. Zero when on time or early. */
  minutes: number;
  severity: LatenessSeverity;
  /** True when a justification must be recorded, i.e. any lateness at all. */
  requiresReason: boolean;
  /** Reader-facing sentence, naming planned, actual and the difference. */
  message: string;
  messageEn: string;
}

/** Minutes since midnight for "HH:MM". */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes since midnight as "HH:MM", wrapping past midnight. */
function toHhmm(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function severityForMinutes(minutes: number): LatenessSeverity {
  if (minutes <= 0) return "NONE";
  if (minutes <= 15) return "YELLOW";
  if (minutes <= 45) return "ORANGE";
  return "RED";
}

/**
 * Compare a clock-in against the planned start.
 *
 * `plannedStart` and `actualStart` are "HH:MM" on the shift's own date. A
 * clock-in shortly BEFORE a shift that starts just after midnight would
 * otherwise read as 23 hours and 50 minutes late, so a difference beyond half
 * a day is treated as early rather than catastrophically late.
 */
export function assessLateness(
  plannedStart: string,
  actualStart: string,
): Lateness {
  const planned = toMinutes(plannedStart);
  const actual = toMinutes(actualStart);

  let diff = actual - planned;
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;

  const minutes = Math.max(0, diff);
  const severity = severityForMinutes(minutes);

  if (severity === "NONE") {
    return {
      minutes: 0,
      severity,
      requiresReason: false,
      message: `Geplanter Schichtbeginn: ${toHhmm(planned)} Uhr. Eingestempelt: ${toHhmm(actual)} Uhr. Pünktlich.`,
      messageEn: `Planned shift start: ${toHhmm(planned)}. Clocked in: ${toHhmm(actual)}. On time.`,
    };
  }

  return {
    minutes,
    severity,
    // Any lateness at all, however small. A five-minute rule would quietly
    // drop exactly the cases a manager is most likely to ask about later.
    requiresReason: true,
    message:
      `Geplanter Schichtbeginn: ${toHhmm(planned)} Uhr. ` +
      `Eingestempelt: ${toHhmm(actual)} Uhr. ` +
      `Verspätung: ${minutes} ${minutes === 1 ? "Minute" : "Minuten"}.`,
    messageEn:
      `Planned shift start: ${toHhmm(planned)}. ` +
      `Clocked in: ${toHhmm(actual)}. ` +
      `Late by ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
  };
}
