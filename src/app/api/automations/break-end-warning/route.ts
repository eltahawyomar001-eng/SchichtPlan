import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushNotification } from "@/lib/notifications/push";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";

/**
 * POST /api/automations/break-end-warning
 *
 * Sends server-side WebPush notifications for employees whose break is
 * ending within the next 5 minutes, or has just ended (overrun).
 *
 * Runs every 5 minutes via Vercel Cron. Notifications are idempotent —
 * each entry receives at most one "warning" push and one "ended" push
 * per break session (deduplication via the Notification.link tag).
 *
 * Timezone: assumes Europe/Berlin for break-time calculations (German market).
 */
export const POST = withRoute(
  "/api/automations/break-end-warning",
  "POST",
  async (req) => {
    // ── Auth: cron secret only ──
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 403 },
      );
    }

    const monitor = cronMonitor("break-end-warning", "*/5 * * * *");
    const now = new Date();
    const tz = "Europe/Berlin";

    // Current time in Berlin as total minutes since midnight (for elapsed calc)
    const nowBerlinHHMM = now.toLocaleTimeString("de-DE", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [nowH, nowM] = nowBerlinHHMM.split(":").map(Number);
    const nowMin = nowH * 60 + nowM;

    // Find all active breaks (breakStart set, breakEnd not yet set)
    const activeBreaks = await prisma.timeEntry.findMany({
      where: {
        isLiveClock: true,
        clockOutAt: null,
        breakStart: { not: null },
        breakEnd: null,
      },
      include: {
        workspace: { select: { defaultBreakMinutes: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (activeBreaks.length === 0) {
      monitor.finish("ok");
      return NextResponse.json({ checked: 0, warned: 0, overrun: 0 });
    }

    let warned = 0;
    let overrun = 0;

    for (const entry of activeBreaks) {
      const defaultBreakMin = entry.workspace.defaultBreakMinutes;
      if (!entry.breakStart || defaultBreakMin <= 0) continue;
      if (!entry.employee.email) continue;

      // Parse breakStart HH:MM → minutes since midnight
      const [bh, bm] = entry.breakStart.split(":").map(Number);
      const breakStartMin = bh * 60 + bm;

      // Elapsed minutes since break started (handles midnight crossover)
      let elapsedMin = nowMin - breakStartMin;
      if (elapsedMin < 0) elapsedMin += 24 * 60;

      // Skip stale entries (break > 60 min old and overrun > 5 min — spam guard)
      if (elapsedMin > defaultBreakMin + 5) continue;

      // Determine which notification to send
      const warnThreshold = defaultBreakMin - 5;
      let notifType: "warning" | "ended" | null = null;

      if (
        defaultBreakMin > 5 &&
        elapsedMin >= warnThreshold &&
        elapsedMin < defaultBreakMin
      ) {
        notifType = "warning";
      } else if (elapsedMin >= defaultBreakMin) {
        notifType = "ended";
      }

      if (!notifType) continue;

      // Resolve the user account linked to this employee
      const user = await prisma.user.findFirst({
        where: { email: entry.employee.email },
        select: { id: true },
      });
      if (!user) continue;

      // Idempotency key per break session (entry ID is unique per break)
      const tag =
        notifType === "warning"
          ? `break-end-warning-${entry.id}`
          : `break-ended-notif-${entry.id}`;

      // Skip if already sent
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          link: `/stempeluhr?breakNotif=${tag}`,
        },
      });
      if (alreadySent) continue;

      const remainingMin = Math.max(1, defaultBreakMin - elapsedMin);
      const title =
        notifType === "warning" ? "Pause endet bald" : "Pause beendet";
      const body =
        notifType === "warning"
          ? `Noch ${remainingMin} Min. bis deine ${defaultBreakMin}-minütige Pause endet.`
          : `Deine ${defaultBreakMin}-minütige Pause ist abgelaufen. Bitte kehre zur Arbeit zurück.`;

      // Persist in-app notification (dedup anchor + inbox)
      await prisma.notification.create({
        data: {
          type: "BREAK_REMINDER",
          title,
          message: body,
          link: `/stempeluhr?breakNotif=${tag}`,
          userId: user.id,
          workspaceId: entry.workspaceId,
        },
      });

      // Send WebPush (works even when the browser tab is closed / phone locked)
      await sendPushNotification({
        userId: user.id,
        title,
        body,
        url: "/stempeluhr",
        tag,
      });

      if (notifType === "warning") {
        warned++;
        log.info(
          `[break-end-warning] 5-min warning → ${entry.employee.firstName} ${entry.employee.lastName} (${elapsedMin}/${defaultBreakMin} min)`,
          { entryId: entry.id, employeeId: entry.employeeId },
        );
      } else {
        overrun++;
        log.info(
          `[break-end-warning] Break ended → ${entry.employee.firstName} ${entry.employee.lastName} (${elapsedMin}/${defaultBreakMin} min)`,
          { entryId: entry.id, employeeId: entry.employeeId },
        );
      }
    }

    log.info(
      `[break-end-warning] Checked ${activeBreaks.length} active breaks — warned: ${warned}, ended: ${overrun}`,
    );

    monitor.finish("ok");
    return NextResponse.json({
      checked: activeBreaks.length,
      warned,
      overrun,
    });
  },
);
