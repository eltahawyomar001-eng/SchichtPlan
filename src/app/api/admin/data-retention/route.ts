import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

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
  skipped?: boolean;
  reason?: string;
}

/** Cutoff date helper */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Safety threshold — abort deletion if >50% of table rows would be deleted */
const SAFETY_THRESHOLD = 0.5;
/** Alert threshold — log Sentry warning if >1000 rows deleted in one table */
const ALERT_THRESHOLD = 1000;

/**
 * Safely delete rows from a table with pre-delete count validation.
 * Aborts if deletion count exceeds SAFETY_THRESHOLD of total rows.
 */
async function safeDelete(
  table: string,
  deleteWhere: Record<string, unknown>,
  countFn: (where?: Record<string, unknown>) => Promise<number>,
  deleteFn: (args: {
    where: Record<string, unknown>;
  }) => Promise<{ count: number }>,
  dryRun: boolean,
): Promise<RetentionResult> {
  const deleteCount = await countFn(deleteWhere);

  if (deleteCount === 0) {
    return { table, deleted: 0 };
  }

  const totalCount = await countFn();

  if (totalCount > 0 && deleteCount > totalCount * SAFETY_THRESHOLD) {
    const msg = `Data retention: refusing to delete ${deleteCount}/${totalCount} (>${SAFETY_THRESHOLD * 100}%) of ${table}`;
    log.error(msg, { table, deleteCount, totalCount });
    captureRouteError(new Error(msg), {
      route: "/api/admin/data-retention",
      method: "POST",
    });
    return {
      table,
      deleted: 0,
      skipped: true,
      reason: `Safety threshold exceeded (${deleteCount}/${totalCount})`,
    };
  }

  if (dryRun) {
    log.info(
      `[data-retention] Dry run: would delete ${deleteCount} from ${table}`,
      { table, deleteCount },
    );
    return { table, deleted: deleteCount, skipped: true, reason: "dry-run" };
  }

  const result = await deleteFn({ where: deleteWhere });

  if (result.count > ALERT_THRESHOLD) {
    log.warn(
      `[data-retention] High volume deletion: ${result.count} rows from ${table}`,
      { table, count: result.count },
    );
    captureRouteError(
      new Error(
        `Data retention: high volume deletion (${result.count} rows) from ${table}`,
      ),
      { route: "/api/admin/data-retention", method: "POST" },
    );
  }

  log.info(`[data-retention] Deleted ${result.count} from ${table}`, {
    table,
    count: result.count,
  });
  return { table, deleted: result.count };
}

async function executeRetention(dryRun = false): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];

  // 1. VerificationToken — 7 days
  results.push(
    await safeDelete(
      "VerificationToken",
      { expires: { lt: daysAgo(7) } },
      (w) => prisma.verificationToken.count(w ? { where: w } : undefined),
      (a) => prisma.verificationToken.deleteMany(a),
      dryRun,
    ),
  );

  // 2. PasswordResetToken — 7 days
  results.push(
    await safeDelete(
      "PasswordResetToken",
      { expires: { lt: daysAgo(7) } },
      (w) => prisma.passwordResetToken.count(w ? { where: w } : undefined),
      (a) => prisma.passwordResetToken.deleteMany(a),
      dryRun,
    ),
  );

  // 3. Session — 30 days
  results.push(
    await safeDelete(
      "Session",
      { expires: { lt: daysAgo(30) } },
      (w) => prisma.session.count(w ? { where: w } : undefined),
      (a) => prisma.session.deleteMany(a),
      dryRun,
    ),
  );

  // 4. Invitation (expired) — 30 days past expiry
  results.push(
    await safeDelete(
      "Invitation",
      { expiresAt: { lt: daysAgo(30) } },
      (w) => prisma.invitation.count(w ? { where: w } : undefined),
      (a) => prisma.invitation.deleteMany(a),
      dryRun,
    ),
  );

  // 5. Notification — 90 days
  results.push(
    await safeDelete(
      "Notification",
      { createdAt: { lt: daysAgo(90) } },
      (w) => prisma.notification.count(w ? { where: w } : undefined),
      (a) => prisma.notification.deleteMany(a),
      dryRun,
    ),
  );

  // 6. ExportJob — 90 days
  results.push(
    await safeDelete(
      "ExportJob",
      { createdAt: { lt: daysAgo(90) } },
      (w) => prisma.exportJob.count(w ? { where: w } : undefined),
      (a) => prisma.exportJob.deleteMany(a),
      dryRun,
    ),
  );

  // 7. AutoFillLog — 90 days
  results.push(
    await safeDelete(
      "AutoFillLog",
      { createdAt: { lt: daysAgo(90) } },
      (w) => prisma.autoFillLog.count(w ? { where: w } : undefined),
      (a) => prisma.autoFillLog.deleteMany(a),
      dryRun,
    ),
  );

  // 8. ManagerAlert — acknowledged, 90 days
  results.push(
    await safeDelete(
      "ManagerAlert (acknowledged)",
      { acknowledged: true, acknowledgedAt: { lt: daysAgo(90) } },
      (w) => prisma.managerAlert.count(w ? { where: w } : undefined),
      (a) => prisma.managerAlert.deleteMany(a),
      dryRun,
    ),
  );

  // 9. AutoScheduleRun — 180 days
  results.push(
    await safeDelete(
      "AutoScheduleRun",
      { createdAt: { lt: daysAgo(180) } },
      (w) => prisma.autoScheduleRun.count(w ? { where: w } : undefined),
      (a) => prisma.autoScheduleRun.deleteMany(a),
      dryRun,
    ),
  );

  // 10. PushSubscription — 180 days without activity
  results.push(
    await safeDelete(
      "PushSubscription",
      { createdAt: { lt: daysAgo(180) } },
      (w) => prisma.pushSubscription.count(w ? { where: w } : undefined),
      (a) => prisma.pushSubscription.deleteMany(a),
      dryRun,
    ),
  );

  // 11. AuditLog — 365 days
  results.push(
    await safeDelete(
      "AuditLog",
      { createdAt: { lt: daysAgo(365) } },
      (w) => prisma.auditLog.count(w ? { where: w } : undefined),
      (a) => prisma.auditLog.deleteMany(a),
      dryRun,
    ),
  );

  // 12. ChatMessage — 365 days (cascade deletes reactions/attachments)
  results.push(
    await safeDelete(
      "ChatMessage",
      { createdAt: { lt: daysAgo(365) } },
      (w) => prisma.chatMessage.count(w ? { where: w } : undefined),
      (a) => prisma.chatMessage.deleteMany(a),
      dryRun,
    ),
  );

  // Note: ESignature (10y), ServiceVisitAuditLog (10y), TimeEntryAudit (10y)
  // are retained for legal/tax compliance (§147 AO, eIDAS).
  // They are NOT auto-deleted by this job.

  return results;
}

/** POST — Admin-triggered retention */
export const POST = withRoute(
  "/api/admin/data-retention",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";

    const results = await executeRetention(dryRun);
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    log.info(
      `[data-retention] Admin ${user.email} triggered retention${dryRun ? " (dry-run)" : ""}: ${totalDeleted} records ${dryRun ? "would be " : ""}deleted`,
      { results, dryRun },
    );

    createAuditLog({
      action: "DELETE",
      entityType: "DataRetention",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { totalDeleted, results, dryRun },
    });

    dispatchWebhook(workspaceId, "data_retention.executed", {
      totalDeleted,
      dryRun,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      dryRun,
      totalDeleted,
      results,
    });
  },
  { idempotent: true },
);

/** GET — Vercel Cron handler */
export const GET = withRoute(
  "/api/admin/data-retention",
  "GET",
  async (req) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 403 },
      );
    }

    const monitor = cronMonitor("data-retention", "30 4 * * 0");
    const results = await executeRetention();
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    log.info(
      `[data-retention] Cron retention: ${totalDeleted} records deleted`,
      { results },
    );

    monitor.finish("ok");
    return NextResponse.json({
      success: true,
      totalDeleted,
      results,
    });
  },
);
