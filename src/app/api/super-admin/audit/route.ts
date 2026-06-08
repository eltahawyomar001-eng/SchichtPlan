import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import { runUnscoped } from "@/lib/workspace-scope";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/super-admin/audit
 * Cross-workspace view of privileged super-admin actions (extend-trial,
 * change-plan, …). Filters to AuditLog rows whose metadata carries a
 * `superAdminAction` marker. Wrapped in runUnscoped() so the workspace-scope
 * backstop never narrows this intentionally cross-tenant query.
 */
export const GET = withRoute("/api/super-admin/audit", "GET", async () => {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const rows = await runUnscoped(() =>
    prisma.auditLog.findMany({
      where: { metadata: { contains: "superAdminAction" } },
      include: { workspace: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );

  const entries = rows.map((r) => {
    let metadata: Record<string, unknown> = {};
    let changes: Record<string, unknown> | null = null;
    try {
      if (r.metadata) metadata = JSON.parse(r.metadata);
    } catch {
      /* leave empty */
    }
    try {
      if (r.changes) changes = JSON.parse(r.changes);
    } catch {
      /* leave null */
    }
    return {
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      workspaceName: r.workspace?.name ?? r.workspaceId,
      workspaceSlug: r.workspace?.slug ?? null,
      actorEmail: r.userEmail,
      createdAt: r.createdAt,
      superAdminAction: String(metadata.superAdminAction ?? r.action),
      metadata,
      changes,
    };
  });

  return NextResponse.json({ entries });
});
