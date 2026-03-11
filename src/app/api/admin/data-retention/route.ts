import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";

/**
 * POST /api/admin/data-retention
 *
 * DSGVO Löschkonzept — Automated data retention enforcement.
 * Runs via Vercel Cron (weekly, Sundays 04:30 UTC) or manually by OWNER/ADMIN.
 *
 * ⚠️  DESIGN NOTE (Security Audit 2026-03-11):
 * This endpoint intentionally operates CROSS-WORKSPACE. Retention is
 * purely TTL-based (records older than X days are deleted regardless of
 * workspace). This is correct because:
 *   1. Expired tokens, sessions, and notifications have no business value.
 *   2. Legal retention periods (§147 AO, eIDAS) apply globally, not per-tenant.
 *   3. The POST handler requires OWNER/ADMIN auth (scoped to the caller's
 *      workspace for authorization, but the cleanup itself is global).
 *   4. The GET handler requires CRON_SECRET (server-to-server only).
 *
 * Retention periods (Art. 5(1)(e) DSGVO — Speicherbegrenzung):
 *
 * | Data                     | Retention       | Legal basis                          |
 * |--------------------------|-----------------|--------------------------------------|
 * | VerificationToken        | 7 days          | No legal requirement                 |
 * | PasswordResetToken       | 7 days          | No legal requirement                 |
 * | Notification             | 90 days         | No legal requirement                 |
 * | Invitation (expired)     | 30 days         | No legal requirement                 |
 * | Session                  | 30 days         | Art. 6(1)(b) — expired sessions      |
 * | AuditLog                 | 365 days        | Art. 6(1)(f) — security              |
 * | ESignature               | 3650 days       | §147 AO / eIDAS — 10 years          |
 * | ChatMessage              | 365 days        | No legal requirement                 |
 * | ExportJob                | 90 days         | No legal requirement                 |
 * | ServiceVisitAuditLog     | 3650 days       | §147 AO — tax/commercial records     |
 * | TimeEntryAudit           | 3650 days       | §147 AO — payroll records            |
 * | AutoFillLog              | 90 days         | No legal requirement                 |
 * | ManagerAlert (resolved)  | 90 days         | No legal requirement                 |
 * | AutoScheduleRun          | 180 days        | No legal requirement                 |
 * | PushSubscription         | 180 days        | No legal requirement (stale)         |
 *
 * Also accepts GET for Vercel Cron with CRON_SECRET header.
 */

interface RetentionResult {
  table: string;
  deleted: number;
}

/** Cutoff date helper */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function executeRetention(): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];

  // 1. VerificationToken — 7 days
  const vt = await prisma.verificationToken.deleteMany({
    where: { expires: { lt: daysAgo(7) } },
  });
  results.push({ table: "VerificationToken", deleted: vt.count });

  // 2. PasswordResetToken — 7 days
  const prt = await prisma.passwordResetToken.deleteMany({
    where: { expires: { lt: daysAgo(7) } },
  });
  results.push({ table: "PasswordResetToken", deleted: prt.count });

  // 3. Session — 30 days
  const sess = await prisma.session.deleteMany({
    where: { expires: { lt: daysAgo(30) } },
  });
  results.push({ table: "Session", deleted: sess.count });

  // 4. Invitation (expired) — 30 days past expiry
  const inv = await prisma.invitation.deleteMany({
    where: { expiresAt: { lt: daysAgo(30) } },
  });
  results.push({ table: "Invitation", deleted: inv.count });

  // 5. Notification — 90 days
  const notif = await prisma.notification.deleteMany({
    where: { createdAt: { lt: daysAgo(90) } },
  });
  results.push({ table: "Notification", deleted: notif.count });

  // 6. ExportJob — 90 days
  const ej = await prisma.exportJob.deleteMany({
    where: { createdAt: { lt: daysAgo(90) } },
  });
  results.push({ table: "ExportJob", deleted: ej.count });

  // 7. AutoFillLog — 90 days
  const afl = await prisma.autoFillLog.deleteMany({
    where: { createdAt: { lt: daysAgo(90) } },
  });
  results.push({ table: "AutoFillLog", deleted: afl.count });

  // 8. ManagerAlert — acknowledged, 90 days
  const ma = await prisma.managerAlert.deleteMany({
    where: {
      acknowledged: true,
      acknowledgedAt: { lt: daysAgo(90) },
    },
  });
  results.push({ table: "ManagerAlert (acknowledged)", deleted: ma.count });

  // 9. AutoScheduleRun — 180 days
  const asr = await prisma.autoScheduleRun.deleteMany({
    where: { createdAt: { lt: daysAgo(180) } },
  });
  results.push({ table: "AutoScheduleRun", deleted: asr.count });

  // 10. PushSubscription — 180 days without activity
  const ps = await prisma.pushSubscription.deleteMany({
    where: { createdAt: { lt: daysAgo(180) } },
  });
  results.push({ table: "PushSubscription", deleted: ps.count });

  // 11. AuditLog — 365 days
  const al = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: daysAgo(365) } },
  });
  results.push({ table: "AuditLog", deleted: al.count });

  // 12. ChatMessage — 365 days (cascade deletes reactions/attachments)
  const cm = await prisma.chatMessage.deleteMany({
    where: { createdAt: { lt: daysAgo(365) } },
  });
  results.push({ table: "ChatMessage", deleted: cm.count });

  // Note: ESignature (10y), ServiceVisitAuditLog (10y), TimeEntryAudit (10y)
  // are retained for legal/tax compliance (§147 AO, eIDAS).
  // They are NOT auto-deleted by this job.

  return results;
}

/** POST — Admin-triggered retention */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    const results = await executeRetention();
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    log.info(
      `[data-retention] Admin ${user.email} triggered retention: ${totalDeleted} records deleted`,
      { results },
    );

    return NextResponse.json({
      success: true,
      totalDeleted,
      results,
    });
  } catch (error) {
    log.error("Data retention error:", { error });
    return NextResponse.json({ error: "Retention failed" }, { status: 500 });
  }
}

/** GET — Vercel Cron handler */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 403 },
      );
    }

    const results = await executeRetention();
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    log.info(
      `[data-retention] Cron retention: ${totalDeleted} records deleted`,
      { results },
    );

    return NextResponse.json({
      success: true,
      totalDeleted,
      results,
    });
  } catch (error) {
    log.error("Data retention cron error:", { error });
    return NextResponse.json({ error: "Retention failed" }, { status: 500 });
  }
}
