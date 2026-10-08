/**
 * The deviations on one time entry, as the employee and the employer both see
 * them.
 *
 * One component for both views on purpose. The spec requires the same lateness
 * information in the employee app and the employer account, and two renderers
 * drift: the day one of them rounds differently or drops a band is the day the
 * two sides of a wage conversation stop agreeing on what happened.
 *
 * Nothing here alters a recorded time. The highlight sits over the stamped
 * value, which is displayed exactly as captured.
 */
"use client";

import type { EntryAssessment } from "@/lib/time-entry-assessment";
import type { LatenessSeverity } from "@/lib/lateness";

/**
 * Band colours.
 *
 * Deliberately paired with a word in the label rather than carrying meaning on
 * their own: a colour alone excludes anyone red/green colour-blind, and a
 * payroll dispute is a poor place to discover that.
 */
const SEVERITY_CLASS: Record<Exclude<LatenessSeverity, "NONE">, string> = {
  YELLOW:
    "bg-yellow-100 text-yellow-900 ring-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-200 dark:ring-yellow-800",
  ORANGE:
    "bg-orange-100 text-orange-900 ring-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800",
  RED: "bg-red-100 text-red-900 ring-red-300 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800",
};

const NEUTRAL_WARN =
  "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800";

function Badge({
  className,
  children,
  title,
}: {
  className: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function DeviationBadges({
  assessment,
  className = "",
}: {
  assessment: EntryAssessment | null | undefined;
  className?: string;
}) {
  if (!assessment) return null;
  const { lateness, breaks, latenessReasonMissing } = assessment;

  const badges: React.ReactNode[] = [];

  if (lateness && lateness.severity !== "NONE") {
    badges.push(
      <Badge
        key="late"
        className={SEVERITY_CLASS[lateness.severity]}
        title={lateness.message}
      >
        Verspätung: {lateness.minutes} Min.
      </Badge>,
    );
  }

  if (latenessReasonMissing) {
    // The exact wording the spec asks managers to look for.
    badges.push(
      <Badge key="reason" className={NEUTRAL_WARN}>
        Begründung der Verspätung fehlt
      </Badge>,
    );
  }

  for (const d of breaks.deviations) {
    badges.push(
      <Badge key={d.code} className={NEUTRAL_WARN} title={d.message}>
        {d.code === "BREAK_MISSING" && "Pause fehlt"}
        {d.code === "BREAK_TOO_SHORT" &&
          `Pause zu kurz: ${d.shortfallMinutes} Min. fehlen`}
        {d.code === "STRETCH_OVER_6H" && "Über 6 Std. ohne Pause"}
      </Badge>,
    );
  }

  if (badges.length === 0) return null;
  return <div className={`flex flex-wrap gap-1 ${className}`}>{badges}</div>;
}

/**
 * The full sentence, for a detail view where there is room for it.
 *
 * Shown even when somebody was punctual: "planned 08:00, clocked in 07:58"
 * answers the question a manager opened the entry to ask, and an empty space
 * does not.
 */
export function LatenessHint({
  assessment,
}: {
  assessment: EntryAssessment | null | undefined;
}) {
  if (!assessment?.lateness) return null;
  const { lateness } = assessment;
  const tone =
    lateness.severity === "NONE"
      ? "text-gray-600 dark:text-gray-400"
      : "text-gray-900 dark:text-gray-100 font-medium";
  return <p className={`text-sm ${tone}`}>{lateness.message}</p>;
}
