import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { apnsConfigFromEnv, sendAlertPush } from "@/lib/apns";

/**
 * One place that tells a person something happened.
 *
 * Notifications were previously written straight to the table at each call
 * site, which is why the iOS app never received any: there was no single point
 * a push could be attached to. Everything that notifies now goes through here,
 * so adding a channel later is one change rather than a dozen.
 *
 * The in-app row is written FIRST and independently of the push. A failed push
 * must never cost the record: the notification centre in the web app is the
 * durable copy, and the push is a best-effort nudge toward it.
 */

/**
 * What happened. Used for grouping, for quiet-hours policy, and as the
 * notification `type` column.
 *
 * The set follows what shift-scheduling software is expected to notify on:
 * assignment and change of shifts, swap requests and their outcomes, open
 * shifts offered, and absence decisions.
 */
export type NotifyKind =
  | "shift.assigned"
  | "shift.changed"
  | "shift.cancelled"
  | "shift.open_offered"
  | "swap.requested"
  | "swap.approved"
  | "swap.rejected"
  | "absence.requested"
  | "absence.approved"
  | "absence.rejected";

/**
 * Which events may wake someone outside working hours.
 *
 * A shift assigned for tomorrow morning, or a swap that changes whether
 * somebody is working, is worth a late alert. An approval on a request they
 * filed weeks ago is not. Quiet hours are the part of this that a person
 * actually feels, and getting it wrong is how apps get their notifications
 * switched off entirely.
 */
const URGENT: ReadonlySet<NotifyKind> = new Set<NotifyKind>([
  "shift.assigned",
  "shift.changed",
  "shift.cancelled",
  "swap.requested",
]);

/** Local hours during which non-urgent pushes are held back. */
const QUIET_FROM_HOUR = 21;
const QUIET_UNTIL_HOUR = 7;

/** True when a non-urgent push should not be delivered right now. */
export function inQuietHours(
  kind: NotifyKind,
  now: Date,
  timeZone: string,
): boolean {
  if (URGENT.has(kind)) return false;
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone,
      }).format(now),
    );
  } catch {
    // An unknown zone must not silence a notification entirely.
    return false;
  }
  if (!Number.isFinite(hour)) return false;
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

export interface NotifyInput {
  kind: NotifyKind;
  /** Recipients, by User id. Each gets their own row and their own pushes. */
  userIds: string[];
  workspaceId: string;
  title: string;
  message: string;
  /** In-app link, also used as the deep link the push opens. */
  link?: string;
  /**
   * Collapse key. Republishing a schedule three times should read as one
   * update, not three alerts.
   */
  collapseId?: string;
  timeZone?: string;
}

/**
 * Record the notification and push it. Never throws.
 *
 * Callers are business operations -- assigning a shift, approving leave -- and
 * none of them should fail because a notification could not be delivered.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const {
    kind,
    userIds,
    workspaceId,
    title,
    message,
    link,
    collapseId,
    timeZone = "Europe/Berlin",
  } = input;

  const recipients = [...new Set(userIds)].filter(Boolean);
  if (recipients.length === 0) return;

  // ── The durable record ───────────────────────────────────────────────
  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        type: kind,
        title,
        message,
        link: link ?? null,
        userId,
        workspaceId,
      })),
    });
  } catch (err) {
    log.error("[notify] could not record notification", {
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
    // Still attempt the push: the person being told matters more than the row.
  }

  // ── The push ─────────────────────────────────────────────────────────
  try {
    const cfg = apnsConfigFromEnv();
    if (!cfg) return;

    // Quiet hours change HOW the push is delivered, not whether it is.
    //
    // Returning here meant anyone who did not open the app simply never
    // learned -- an approval decided at 22:00 reached nobody. Delivering with
    // iOS "passive" puts it in Notification Center without a sound or waking
    // the screen, so it is waiting in the morning instead of lost.
    const quiet = inQuietHours(kind, new Date(), timeZone);
    if (quiet) log.info("[notify] delivering quietly", { kind });

    const devices = await prisma.deviceToken.findMany({
      where: { userId: { in: recipients }, workspaceId },
    });
    if (devices.length === 0) return;

    const dead: string[] = [];
    await Promise.all(
      devices.map(async (d) => {
        const res = await sendAlertPush({
          cfg,
          deviceToken: d.token,
          title,
          body: message,
          link,
          collapseId: collapseId ?? kind,
          quiet,
        });
        if (res.gone) dead.push(d.token);
        else if (!res.ok)
          log.warn("[notify] push failed", {
            kind,
            status: res.status,
            reason: res.reason,
          });
      }),
    );

    if (dead.length > 0) {
      // APNs says these installs are gone; keeping them means retrying a
      // corpse on every future notification.
      await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    }

    const live = devices
      .filter((d) => !dead.includes(d.token))
      .map((d) => d.id);
    if (live.length > 0) {
      await prisma.deviceToken.updateMany({
        where: { id: { in: live } },
        data: { lastUsedAt: new Date() },
      });
    }
  } catch (err) {
    log.warn("[notify] push delivery failed", {
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resolve the User ids behind a set of Employee ids, skipping unlinked ones.
 *
 * Never throws, for the same reason notify() does not: this is called from
 * inside business operations -- creating a shift, deciding a swap -- and a
 * lookup failure here must not fail the operation itself. It did: a shift
 * creation returned 500 because the notification step could not resolve a
 * recipient, which is a shift that was never created because nobody could be
 * told about it.
 *
 * An empty list means "notify nobody", which is the correct degradation: the
 * shift exists, and the in-app record is still written by the caller's own
 * path.
 */
export async function userIdsForEmployees(
  employeeIds: string[],
  workspaceId: string,
): Promise<string[]> {
  const ids = [...new Set(employeeIds)].filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const rows = await prisma.employee.findMany({
      where: { id: { in: ids }, workspaceId, userId: { not: null } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId!).filter(Boolean);
  } catch (err) {
    log.warn("[notify] could not resolve recipients", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
