import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushNotification } from "@/lib/notifications/push";
import { ensureLegalBreak, ARBZG_MAX_DAILY_MINUTES } from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";

/**
 * POST /api/automations/break-reminder
 *
 * Checks all currently clocked-in employees:
 * 1. If working 6+ hours without break → sends break reminder notification.
 * 2. If working 10+ hours → force-stops the clock (ArbZG §3 max daily work time).
 *
 * German labor law (ArbZG):
 * - §3: Max 10 hours of work per day
 * - §4: 30 min break after 6h, 45 min after 9h
 * - §5: 11 hours rest between shifts (enforced at clock-in)
 *
 * Called via Vercel Cron every 15 minutes.
 *
 * Failure contract:
 *  - Push notification failures are caught per-item and logged; they never
 *    abort the loop or prevent the cron from completing.
 *  - Any unhandled exception calls monitor.finish("error") so Sentry cron
 *    checks alert instead of silently staying "in_progress".
 */
export const POST = withRoute(
  "/api/automations/break-reminder",
  "POST",
  async (req) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 403 },
      );
    }

    const monitor = cronMonitor("break-reminder", "*/15 * * * *");

    try {
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      const overdueEntries = await prisma.timeEntry.findMany({
        where: {
          isLiveClock: true,
          clockOutAt: null,
          breakStart: null,
          clockInAt: { lte: sixHoursAgo },
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      let notified = 0;

      for (const entry of overdueEntries) {
        if (!entry.employee.email) continue;

        const user = await prisma.user.findFirst({
          where: { email: entry.employee.email },
          select: { id: true },
        });
        if (!user) continue;

        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: "BREAK_REMINDER",
            link: `/stempeluhr?entryId=${entry.id}`,
          },
        });
        if (alreadyNotified) continue;

        const workedMinutes = Math.round(
          (now.getTime() - entry.clockInAt!.getTime()) / 60000,
        );
        const workedHours = Math.floor(workedMinutes / 60);
        const workedMins = workedMinutes % 60;

        const title = "Pausenerinnerung";
        const message = `Sie arbeiten seit ${workedHours}h ${workedMins}min ohne Pause. Nach dem Arbeitszeitgesetz (ArbZG §4) ist eine Pause von mindestens 30 Minuten nach 6 Stunden Pflicht.`;

        await prisma.notification.create({
          data: {
            type: "BREAK_REMINDER",
            title,
            message,
            link: `/stempeluhr?entryId=${entry.id}`,
            userId: user.id,
            workspaceId: entry.workspaceId,
          },
        });

        // Push is best-effort — failure must not abort the loop
        try {
          await sendPushNotification({
            userId: user.id,
            title,
            body: message,
            url: "/stempeluhr",
            tag: `break-reminder-${entry.id}`,
          });
        } catch (pushErr) {
          log.error(
            `[break-reminder] push failed for user ${user.id} entry ${entry.id}`,
            {
              error:
                pushErr instanceof Error ? pushErr.message : String(pushErr),
            },
          );
        }

        notified++;
        log.info(
          `[break-reminder] Notified ${entry.employee.firstName} ${entry.employee.lastName} (${workedHours}h ${workedMins}min without break)`,
        );
      }

      log.info(
        `[break-reminder] Checked ${overdueEntries.length} overdue entries, notified ${notified}`,
      );

      // ── ArbZG §3: Force-stop entries exceeding 10 hours ──────────
      const tenHoursAgo = new Date(
        now.getTime() - ARBZG_MAX_DAILY_MINUTES * 60000,
      );

      const excessiveEntries = await prisma.timeEntry.findMany({
        where: {
          isLiveClock: true,
          clockOutAt: null,
          clockInAt: { lte: tenHoursAgo },
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      let forceStopped = 0;

      for (const entry of excessiveEntries) {
        const clockIn = entry.clockInAt!;
        const grossMinutes = Math.round(
          (now.getTime() - clockIn.getTime()) / 60000,
        );

        let breakMinutes = entry.breakMinutes || 0;
        const endTimeStr = now.toLocaleTimeString("de-DE", {
          timeZone: "Europe/Berlin",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        if (entry.breakStart && !entry.breakEnd) {
          const bsMin = toMinutes(entry.breakStart);
          const beMin = toMinutes(endTimeStr);
          breakMinutes = Math.max(0, beMin - bsMin);
        }

        const cappedGross = ARBZG_MAX_DAILY_MINUTES;
        const legalBreak = ensureLegalBreak(cappedGross, breakMinutes);
        const netMinutes = Math.max(0, cappedGross - legalBreak);

        await prisma.timeEntry.update({
          where: { id: entry.id },
          data: {
            endTime: endTimeStr,
            clockOutAt: now,
            breakEnd:
              entry.breakStart && !entry.breakEnd ? endTimeStr : entry.breakEnd,
            breakMinutes: legalBreak,
            grossMinutes: cappedGross,
            netMinutes,
            remarks: `ArbZG §3: Automatisch gestoppt nach ${Math.floor(grossMinutes / 60)}h ${grossMinutes % 60}min (Höchstarbeitszeit 10h/Tag überschritten)`,
          },
        });

        if (entry.employee.email) {
          const user = await prisma.user.findFirst({
            where: { email: entry.employee.email },
            select: { id: true },
          });

          if (user) {
            const title = "Stempeluhr automatisch gestoppt";
            const message = `Ihre Arbeitszeit wurde nach ${Math.floor(grossMinutes / 60)}h ${grossMinutes % 60}min automatisch beendet. Das Arbeitszeitgesetz (ArbZG §3) erlaubt maximal 10 Stunden Arbeitszeit pro Tag.`;

            await prisma.notification.create({
              data: {
                type: "BREAK_REMINDER",
                title,
                message,
                link: `/stempeluhr`,
                userId: user.id,
                workspaceId: entry.workspaceId,
              },
            });

            try {
              await sendPushNotification({
                userId: user.id,
                title,
                body: message,
                url: "/stempeluhr",
                tag: `arbzg-auto-stop-${entry.id}`,
              });
            } catch (pushErr) {
              log.error(
                `[break-reminder] ArbZG push failed for user ${user.id}`,
                {
                  error:
                    pushErr instanceof Error
                      ? pushErr.message
                      : String(pushErr),
                },
              );
              captureRouteError(pushErr, {
                route: "/api/automations/break-reminder",
                method: "POST",
              });
            }
          }
        }

        forceStopped++;
        log.warn(
          `[break-reminder] ArbZG auto-stop: ${entry.employee.firstName} ${entry.employee.lastName} worked ${Math.floor(grossMinutes / 60)}h ${grossMinutes % 60}min — force-stopped at 10h`,
          { entryId: entry.id, employeeId: entry.employeeId },
        );
      }

      if (forceStopped > 0) {
        log.warn(
          `[break-reminder] Force-stopped ${forceStopped} entries exceeding ArbZG 10h limit`,
        );
      }

      monitor.finish("ok");
      return NextResponse.json({
        checked: overdueEntries.length,
        notified,
        forceStopped,
      });
    } catch (err) {
      log.error("[break-reminder] cron fatal error", { error: err });
      captureRouteError(err, {
        route: "/api/automations/break-reminder",
        method: "POST",
      });
      monitor.finish("error");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
);

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
