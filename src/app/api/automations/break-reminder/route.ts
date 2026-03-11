import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushNotification } from "@/lib/notifications/push";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";

/**
 * POST /api/automations/break-reminder
 *
 * Checks all currently clocked-in employees. If any employee has been
 * working for 6+ hours without starting a break, sends a push notification.
 *
 * German labor law (ArbZG §4): Employees MUST take at least 30 minutes
 * of break after 6 hours of continuous work.
 *
 * Called via Vercel Cron every 15 minutes.
 */
export async function POST(req: Request) {
  try {
    // Authenticate: only cron secret allowed
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 403 },
      );
    }

    const monitor = cronMonitor("break-reminder", "*/15 * * * *");

    const now = new Date();
    // 6 hours ago
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    // Find all active clock-in entries where:
    // 1. Employee is still clocked in (clockOutAt is null)
    // 2. They clocked in more than 6 hours ago
    // 3. They have NOT started a break (breakStart is null)
    const overdueEntries = await prisma.timeEntry.findMany({
      where: {
        isLiveClock: true,
        clockOutAt: null,
        breakStart: null,
        clockInAt: {
          lte: sixHoursAgo,
        },
      },
      include: {
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

    if (overdueEntries.length === 0) {
      return NextResponse.json({ notified: 0 });
    }

    let notified = 0;

    for (const entry of overdueEntries) {
      // Find the user account linked to this employee's email
      if (!entry.employee.email) continue;

      const user = await prisma.user.findFirst({
        where: { email: entry.employee.email },
        select: { id: true },
      });

      if (!user) continue;

      // Check if we already notified this user for this entry
      // (avoid spam — use the entry ID as tag so it's deduplicated)
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

      // Create in-app notification
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

      // Send push notification
      await sendPushNotification({
        userId: user.id,
        title,
        body: message,
        url: "/stempeluhr",
        tag: `break-reminder-${entry.id}`,
      });

      notified++;
      log.info(
        `[break-reminder] Notified ${entry.employee.firstName} ${entry.employee.lastName} (${workedHours}h ${workedMins}min without break)`,
      );
    }

    log.info(
      `[break-reminder] Checked ${overdueEntries.length} overdue entries, notified ${notified}`,
    );

    monitor.finish("ok");
    return NextResponse.json({
      checked: overdueEntries.length,
      notified,
    });
  } catch (error) {
    log.error("[break-reminder] Error:", { error });
    captureRouteError(error, {
      route: "/api/automations/break-reminder",
      method: "POST",
    });
    // If monitor was created before the error, finish it as error
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
