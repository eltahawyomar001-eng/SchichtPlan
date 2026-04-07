import { NextResponse } from "next/server";
import { list, del } from "@vercel/blob";
import { requireAdmin } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/admin/blob-cleanup
 *
 * DSGVO Art. 17 / Art. 5(1)(e) — Löschung verwaister Blob-Dateien.
 *
 * After the DSGVO-driven removal of absence document uploads,
 * orphaned files may still exist in Vercel Blob under the
 * `absences/` prefix. This endpoint lists and deletes them.
 *
 * Access: OWNER / ADMIN only.
 *
 * Query params:
 *   ?dryRun=true  — list files without deleting (default: false)
 */
export const POST = withRoute(
  "/api/admin/blob-cleanup",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";

    // Collect all blobs under the absences/ prefix
    const orphanedUrls: string[] = [];
    let cursor: string | undefined;

    do {
      const result = await list({
        prefix: "absences/",
        cursor,
        limit: 100,
      });

      for (const blob of result.blobs) {
        orphanedUrls.push(blob.url);
      }

      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    if (orphanedUrls.length === 0) {
      return NextResponse.json({
        message: "No orphaned absence blobs found.",
        deleted: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        message: `Dry run — found ${orphanedUrls.length} orphaned blob(s). No files were deleted.`,
        count: orphanedUrls.length,
        urls: orphanedUrls,
      });
    }

    // Delete in batches of 100 (Vercel Blob limit)
    const batchSize = 100;
    for (let i = 0; i < orphanedUrls.length; i += batchSize) {
      const batch = orphanedUrls.slice(i, i + batchSize);
      await del(batch);
    }

    // Audit log
    createAuditLog({
      action: "DELETE",
      entityType: "blob-cleanup",
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId: user.workspaceId!,
      metadata: {
        reason: "DSGVO Art. 17 — Löschung verwaister Abwesenheitsdokumente",
        deletedCount: orphanedUrls.length,
      },
    });

    log.info("Blob cleanup completed", {
      deletedCount: orphanedUrls.length,
      performedBy: user.email,
    });

    return NextResponse.json({
      message: `Successfully deleted ${orphanedUrls.length} orphaned blob(s).`,
      deleted: orphanedUrls.length,
    });
  },
  { idempotent: true },
);
