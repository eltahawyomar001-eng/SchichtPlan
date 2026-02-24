import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";

/**
 * POST /api/admin/gps-cleanup
 *
 * Nullifies GPS coordinates on time entries older than the configured
 * retention period (default: 90 days).
 *
 * GDPR / DSGVO compliance — location data should not be stored
 * indefinitely. This endpoint can be triggered manually by admins
 * or called by a Vercel Cron Job.
 *
 * Query params:
 *   - days: retention period in days (default 90)
 *
 * Also accepts GET for Vercel Cron with CRON_SECRET header.
 */

const DEFAULT_RETENTION_DAYS = 90;

async function cleanupGpsData(retentionDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.timeEntry.updateMany({
    where: {
      date: { lt: cutoff },
      OR: [
        { clockInLat: { not: null } },
        { clockInLng: { not: null } },
        { clockOutLat: { not: null } },
        { clockOutLng: { not: null } },
      ],
    },
    data: {
      clockInLat: null,
      clockInLng: null,
      clockOutLat: null,
      clockOutLng: null,
    },
  });

  return result.count;
}

/** POST — Admin-triggered cleanup */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const days =
      parseInt(searchParams.get("days") || "", 10) || DEFAULT_RETENTION_DAYS;

    const cleaned = await cleanupGpsData(days);

    log.info(
      `[gps-cleanup] Admin ${user.email} cleaned GPS data: ${cleaned} entries (retention: ${days} days)`,
    );

    return NextResponse.json({
      success: true,
      cleanedEntries: cleaned,
      retentionDays: days,
    });
  } catch (error) {
    log.error("GPS cleanup error:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** GET — Vercel Cron-compatible (secured by CRON_SECRET header) */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cleaned = await cleanupGpsData(DEFAULT_RETENTION_DAYS);

    log.info(`[gps-cleanup/cron] Cleaned GPS data: ${cleaned} entries`);

    return NextResponse.json({
      success: true,
      cleanedEntries: cleaned,
      retentionDays: DEFAULT_RETENTION_DAYS,
    });
  } catch (error) {
    log.error("GPS cleanup cron error:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
