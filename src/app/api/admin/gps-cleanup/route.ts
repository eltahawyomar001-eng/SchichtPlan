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
 * Nullifies GPS coordinates across ALL tables older than the configured
 * retention period (default: 90 days).
 *
 * Tables cleaned:
 *   1. TimeEntry        — clockInLat/Lng, clockOutLat/Lng
 *   2. ServiceVisit     — checkInLat/Lng, checkOutLat/Lng
 *   3. VisitSignature   — signedLat/Lng
 *   4. ServiceVisitAuditLog — gpsLat/Lng
 *
 * GDPR / DSGVO compliance (Art. 5 Abs. 1 lit. e — Speicherbegrenzung):
 * Location data should not be stored indefinitely.
 * This endpoint can be triggered manually by admins
 * or called by a Vercel Cron Job (weekly, Sundays 05:00 UTC).
 *
 * Query params:
 *   - days: retention period in days (default 90)
 *
 * Also accepts GET for Vercel Cron with CRON_SECRET header.
 */

const DEFAULT_RETENTION_DAYS = 90;

interface CleanupResult {
  timeEntries: number;
  serviceVisits: number;
  visitSignatures: number;
  auditLogs: number;
  total: number;
}

async function cleanupGpsData(_retentionDays: number): Promise<CleanupResult> {
  // GPS collection is disabled — no coordinates are stored, nothing to clean up.
  // This stub is kept so existing Vercel Cron and admin triggers continue to work
  // without error. Re-enable the body when GPS collection is reactivated with
  // proper legal basis (§ 87 BetrVG Betriebsvereinbarung).
  log.info("[gps-cleanup] GPS_DISABLED — skipping cleanup");
  return {
    timeEntries: 0,
    serviceVisits: 0,
    visitSignatures: 0,
    auditLogs: 0,
    total: 0,
  };
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
      `[gps-cleanup] Admin ${user.email} cleaned GPS data: ${cleaned.total} entries (retention: ${days} days)`,
      { breakdown: cleaned },
    );

    return NextResponse.json({
      success: true,
      ...cleaned,
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

    log.info(`[gps-cleanup/cron] Cleaned GPS data: ${cleaned.total} entries`, {
      breakdown: cleaned,
    });

    return NextResponse.json({
      success: true,
      ...cleaned,
      retentionDays: DEFAULT_RETENTION_DAYS,
    });
  } catch (error) {
    log.error("GPS cleanup cron error:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
