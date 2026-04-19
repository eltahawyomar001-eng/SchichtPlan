import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ARBZG_MAX_DAILY_MINUTES,
  capWorkTimeAtLimit,
  getTodayWorkedMinutes,
} from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";

/**
 * GET /api/automations/auto-clockout
 *
 * Server-side enforcement of ArbZG §3 (10h daily max).
 * Finds all open live-clock entries that have been running for ≥10 hours
 * and forcibly clocks them out — even when the user has closed their browser.
 *
 * Runs via Vercel Cron every 10 minutes.
 * Also catches entries that have been open for > 14h as a safety net
 * (e.g. employee forgot to clock out).
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 401 },
      );
    }

    const monitor = cronMonitor("auto-clockout", "*/10 * * * *");
    monitor?.start();

    const now = new Date();
    const tz = "Europe/Berlin";

    // Find ALL open live-clock entries across all workspaces
    const openEntries = await prisma.timeEntry.findMany({
      where: {
        isLiveClock: true,
        clockOutAt: null,
        clockInAt: { not: null },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let closedCount = 0;
    const errors: string[] = [];

    for (const entry of openEntries) {
      try {
        const clockIn = entry.clockInAt!;
        const elapsedMs = now.getTime() - clockIn.getTime();
        const elapsedMinutes = Math.round(elapsedMs / 60000);

        // Only auto-close if:
        // 1. Session >= ArbZG 10h limit (600 min), OR
        // 2. Session >= 14h (safety net — likely forgot to clock out)
        if (elapsedMinutes < ARBZG_MAX_DAILY_MINUTES) {
          continue;
        }

        // Calculate the clock-out time: clock-in + 10h (not "now" which could be 118h later)
        const maxMs = ARBZG_MAX_DAILY_MINUTES * 60 * 1000;
        const cappedClockOut = new Date(clockIn.getTime() + maxMs);

        // Use the capped time for the endTime display
        const endTimeStr = cappedClockOut.toLocaleTimeString("de-DE", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        // Calculate break
        let breakMinutes = entry.breakMinutes || 0;
        let breakEnd = entry.breakEnd;
        if (entry.breakStart && !entry.breakEnd) {
          // Auto-end break at the capped time
          const bsMin = toMinutes(entry.breakStart);
          const beMin = toMinutes(endTimeStr);
          breakMinutes = Math.max(0, beMin - bsMin);
          breakEnd = endTimeStr;
        }

        // Get today's date for the entry
        const dateOnly = new Date(
          Date.UTC(
            clockIn.getFullYear(),
            clockIn.getMonth(),
            clockIn.getDate(),
          ),
        );

        // Get prior completed work that day
        const todayPrevious = await getTodayWorkedMinutes(
          entry.employeeId,
          dateOnly,
          tz,
        );

        // Cap at 10h
        const grossMinutes = ARBZG_MAX_DAILY_MINUTES; // max 10h for this session
        const capped = capWorkTimeAtLimit(
          grossMinutes,
          breakMinutes,
          todayPrevious,
        );

        await prisma.timeEntry.update({
          where: { id: entry.id },
          data: {
            endTime: endTimeStr,
            clockOutAt: cappedClockOut,
            breakEnd,
            breakMinutes: capped.breakMinutes,
            grossMinutes: capped.cappedGross,
            netMinutes: capped.cappedNet,
            remarks:
              "ArbZG §3: Automatisch ausgestempelt — Höchstarbeitszeit von 10h erreicht (Server-Cron)",
          },
        });

        closedCount++;
        log.info(
          `[auto-clockout] Closed entry ${entry.id} for ${entry.employee.firstName} ${entry.employee.lastName} — was open ${elapsedMinutes} min`,
        );
      } catch (err) {
        const msg = `Failed to close entry ${entry.id}: ${err}`;
        errors.push(msg);
        log.error(`[auto-clockout] ${msg}`);
      }
    }

    monitor?.finish("ok");

    log.info(
      `[auto-clockout] Done: ${closedCount} entries closed out of ${openEntries.length} open`,
    );

    return NextResponse.json({
      success: true,
      openEntries: openEntries.length,
      closedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error("[auto-clockout] Cron error:", { error });
    captureRouteError(error, {
      route: "/api/automations/auto-clockout",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
