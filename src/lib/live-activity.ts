import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { apnsConfigFromEnv, pushToTokens } from "@/lib/apns";

/**
 * Keep an employee's iOS Live Activity in step with the clock, from anywhere.
 *
 * The card on a locked phone can otherwise only be changed by the iOS app while
 * it is running. End a break in the web app and the lock screen goes on
 * asserting "on break" -- not stale-looking, just wrong, with no way to correct
 * itself. So every clock change on the server pushes the new state to whatever
 * activity that employee has running.
 *
 * The payload must be COMPLETE. ActivityKit replaces the content state
 * wholesale, and every property on the Swift side carries a default, so a key
 * omitted here decodes to an empty string or zero and silently blanks that part
 * of the card rather than leaving it alone.
 */

/** Matches DEFAULT_TARGET_SECONDS in the app's features/timeclock/goal.ts. */
const DEFAULT_TARGET_SECONDS = 8 * 3600;

/** "HH:MM" -> minutes past midnight, or null. */
function parseHm(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Planned span of a shift in minutes, wrapping past midnight.
 *
 * 22:00 to 06:00 is eight hours, not minus sixteen; read literally it would
 * hand the card a negative target.
 */
function plannedSpanMinutes(
  start?: string | null,
  end?: string | null,
): number | null {
  const s = parseHm(start);
  const e = parseHm(end);
  if (s == null || e == null) return null;
  const span = e >= s ? e - s : e + 24 * 60 - s;
  return span > 0 ? span : null;
}

/** "HH:MM" in the given zone, or "" when there is no time. */
function hhmm(epochSeconds: number, timeZone: string): string {
  if (!epochSeconds || !Number.isFinite(epochSeconds) || epochSeconds <= 0)
    return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(epochSeconds * 1000));
  } catch {
    return "";
  }
}

export interface LiveActivityInputs {
  active: boolean;
  onBreak: boolean;
  /** Clock-in of the running entry. */
  clockInAt: Date | null;
  /** Start of the running break, when one is open. */
  breakStartAt: Date | null;
  /** Completed break minutes on the running entry. */
  breakMinutes: number;
  /** Net minutes from today's already-closed entries. */
  workedBeforeMinutes: number;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  defaultBreakMinutes: number;
  timezone: string;
  companyName: string;
  labels: Record<string, string>;
}

/**
 * Build the exact shape of the Swift `ShiftfyClockAttributes.ContentState`.
 *
 * Key names are the Swift property names: the struct uses synthesized Codable,
 * so its encoded form is its property list. A renamed or missing key decodes to
 * that property's default rather than erroring.
 */
export function buildContentState(
  input: LiveActivityInputs,
): Record<string, unknown> {
  const {
    active,
    onBreak,
    clockInAt,
    breakStartAt,
    breakMinutes,
    workedBeforeMinutes,
    shiftStart,
    shiftEnd,
    defaultBreakMinutes,
    timezone,
    companyName,
    labels,
  } = input;

  const startEpoch = clockInAt ? Math.floor(clockInAt.getTime() / 1000) : 0;
  const breakStartEpoch = breakStartAt
    ? Math.floor(breakStartAt.getTime() / 1000)
    : 0;

  const span = plannedSpanMinutes(shiftStart, shiftEnd);
  const targetSeconds =
    span != null
      ? Math.max(3600, (span - Math.max(0, defaultBreakMinutes)) * 60)
      : DEFAULT_TARGET_SECONDS;

  /**
   * COMPLETED breaks only, exactly as the app computes it.
   *
   * Including the running break would make goalStartEpoch advance second by
   * second; the device derives the frozen reading from breakStartEpoch instead.
   */
  const breakSeconds = Math.max(0, breakMinutes) * 60;
  const workedBeforeSeconds = Math.max(0, workedBeforeMinutes) * 60;

  const goalStartEpoch =
    startEpoch > 0 ? startEpoch - workedBeforeSeconds + breakSeconds : 0;
  const goalEndEpoch = goalStartEpoch > 0 ? goalStartEpoch + targetSeconds : 0;

  const nowEpoch = Math.floor(Date.now() / 1000);
  const runningBreak =
    onBreak && breakStartEpoch > 0
      ? Math.max(0, nowEpoch - breakStartEpoch)
      : 0;
  const netWorkedSeconds =
    goalStartEpoch > 0
      ? Math.max(0, nowEpoch - goalStartEpoch - runningBreak)
      : workedBeforeSeconds;

  const label = (key: string, fallback: string) => labels[key] || fallback;

  return {
    active,
    onBreak,
    startEpoch,
    breakStartEpoch,
    statusLabel: onBreak
      ? label("onBreak", "Pause")
      : active
        ? label("onShift", "Im Dienst")
        : label("offShift", "Ausgestempelt"),
    shiftRange: shiftStart && shiftEnd ? `${shiftStart} – ${shiftEnd}` : "",
    hoursLeftLabel: "",
    targetSeconds,
    goalStartEpoch,
    goalEndEpoch,
    netWorkedSeconds,
    breakSeconds,
    companyName,
    clockInLabel: active ? hhmm(startEpoch, timezone) : "",
    goalEndLabel: active ? hhmm(goalEndEpoch, timezone) : "",
    // Cleared on every push: a warning left from a failed lock-screen punch
    // must not outlive the state that produced it.
    errorLabel: "",
    labels,
  };
}

/**
 * Push the employee's current clock state to their Live Activity.
 *
 * Never throws and never blocks the caller's own result. A punch that
 * succeeded must not be reported as failed because a push did not land; the
 * app corrects the card itself the next time it opens.
 */
export async function syncLiveActivity(opts: {
  employeeId: string;
  workspaceId: string;
  /** True when the clock stopped, which ends the activity rather than updating it. */
  ended?: boolean;
  inputs: Omit<LiveActivityInputs, "companyName" | "labels" | "timezone">;
}): Promise<void> {
  try {
    const cfg = apnsConfigFromEnv();
    if (!cfg) return; // Not configured; nothing to do and nothing to warn about.

    const rows = await prisma.liveActivityToken.findMany({
      where: { employeeId: opts.employeeId, workspaceId: opts.workspaceId },
    });
    if (rows.length === 0) return;

    /**
     * One push per registration, because each carries its own captured labels
     * and timezone. Two devices in different languages must each get their own
     * wording rather than whichever registered last.
     */
    const dead: string[] = [];
    for (const row of rows) {
      const labels =
        (row.labels as Record<string, string> | null) ??
        ({} as Record<string, string>);

      const contentState = buildContentState({
        ...opts.inputs,
        companyName: row.companyName ?? "",
        timezone: row.timezone,
        labels,
      });

      const res = await pushToTokens({
        cfg,
        tokens: [row.token],
        event: opts.ended ? "end" : "update",
        contentState,
      });
      dead.push(...res.dead);
    }

    /**
     * Prune tokens APNs has declared dead, and every token for an activity
     * that just ended -- that activity is gone, so its token can never be
     * used again and would otherwise be retried on every future punch.
     */
    const toDelete = opts.ended ? rows.map((r) => r.token) : dead;
    if (toDelete.length > 0) {
      await prisma.liveActivityToken.deleteMany({
        where: { token: { in: toDelete } },
      });
    }
  } catch (err) {
    log.warn("[live-activity] push failed", {
      employeeId: opts.employeeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Read the employee's current clock state and push it to their Live Activity.
 *
 * Called after every punch, from whichever surface made it. Reading the state
 * back rather than being handed it keeps this correct for actions that change
 * the clock in ways the caller does not model -- and means one call site per
 * branch instead of four bespoke payloads that can drift apart.
 *
 * `breakStartAt` is derived from the stored "HH:MM" against the clock-in date,
 * because that is how the entry records it; the caller passes the converter so
 * this file does not duplicate the timezone arithmetic.
 */
export async function pushCurrentClockState(opts: {
  employeeId: string;
  workspaceId: string;
  timezone: string;
  /** Converts the entry's "HH:MM" break start to a real instant. */
  toInstant: (hhmm: string, reference: Date, tz: string) => string;
}): Promise<void> {
  try {
    const { employeeId, workspaceId, timezone } = opts;

    const open = await prisma.timeEntry.findFirst({
      where: { employeeId, workspaceId, isLiveClock: true, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });

    // No open entry: the clock has stopped, so the activity should END rather
    // than be updated to a resting state it would then display forever.
    if (!open?.clockInAt) {
      await syncLiveActivity({
        employeeId,
        workspaceId,
        ended: true,
        inputs: {
          active: false,
          onBreak: false,
          clockInAt: null,
          breakStartAt: null,
          breakMinutes: 0,
          workedBeforeMinutes: 0,
          defaultBreakMinutes: 30,
        },
      });
      return;
    }

    const onBreak = !!(open.breakStart && !open.breakEnd);
    const breakStartAt =
      onBreak && open.breakStart
        ? new Date(opts.toInstant(open.breakStart, open.clockInAt, timezone))
        : null;

    // Only entries CLOSED earlier today: the open one is what clockInAt is
    // already measuring, and counting it twice puts the bar hours ahead.
    const dayStart = new Date(open.clockInAt);
    dayStart.setHours(0, 0, 0, 0);
    const earlier = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        workspaceId,
        isLiveClock: true,
        clockOutAt: { not: null },
        clockInAt: { gte: dayStart },
      },
      select: { netMinutes: true },
    });
    const workedBeforeMinutes = earlier.reduce(
      (sum, e) => sum + (e.netMinutes ?? 0),
      0,
    );

    const [shift, ws] = await Promise.all([
      prisma.shift.findFirst({
        where: { employeeId, workspaceId, date: open.date, deletedAt: null },
        select: { startTime: true, endTime: true },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { defaultBreakMinutes: true },
      }),
    ]);

    await syncLiveActivity({
      employeeId,
      workspaceId,
      inputs: {
        active: true,
        onBreak,
        clockInAt: open.clockInAt,
        breakStartAt,
        breakMinutes: open.breakMinutes ?? 0,
        workedBeforeMinutes,
        shiftStart: shift?.startTime,
        shiftEnd: shift?.endTime,
        defaultBreakMinutes: ws?.defaultBreakMinutes ?? 30,
      },
    });
  } catch (err) {
    // A push that fails must never turn a successful punch into an error.
    log.warn("[live-activity] state push failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
