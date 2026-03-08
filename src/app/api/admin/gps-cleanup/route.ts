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

async function cleanupGpsData(retentionDays: number): Promise<CleanupResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // 1. TimeEntry GPS (clockIn/clockOut)
  const timeEntries = await prisma.timeEntry.updateMany({
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

  // 2. ServiceVisit GPS (checkIn/checkOut)
  const serviceVisits = await prisma.serviceVisit.updateMany({
    where: {
      scheduledDate: { lt: cutoff },
      OR: [
        { checkInLat: { not: null } },
        { checkInLng: { not: null } },
        { checkOutLat: { not: null } },
        { checkOutLng: { not: null } },
      ],
    },
    data: {
      checkInLat: null,
      checkInLng: null,
      checkOutLat: null,
      checkOutLng: null,
    },
  });

  // 3. VisitSignature GPS (signedLat/Lng)
  const visitSignatures = await prisma.visitSignature.updateMany({
    where: {
      signedAt: { lt: cutoff },
      OR: [{ signedLat: { not: null } }, { signedLng: { not: null } }],
    },
    data: {
      signedLat: null,
      signedLng: null,
    },
  });

  // 4. ServiceVisitAuditLog GPS (gpsLat/Lng)
  const auditLogs = await prisma.serviceVisitAuditLog.updateMany({
    where: {
      serverTimestamp: { lt: cutoff },
      OR: [{ gpsLat: { not: null } }, { gpsLng: { not: null } }],
    },
    data: {
      gpsLat: null,
      gpsLng: null,
      gpsAccuracy: null,
    },
  });

  return {
    timeEntries: timeEntries.count,
    serviceVisits: serviceVisits.count,
    visitSignatures: visitSignatures.count,
    auditLogs: auditLogs.count,
    total:
      timeEntries.count +
      serviceVisits.count +
      visitSignatures.count +
      auditLogs.count,
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
