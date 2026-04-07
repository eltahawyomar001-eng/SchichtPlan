import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/audit-logs?entityType=shift&limit=50&offset=0
 *
 * Returns audit log entries for the workspace. Admin-only.
 *
 * Query params:
 *   - entityType: filter by entity type (optional)
 *   - entityId: filter by entity ID (optional)
 *   - limit: max results (default 50, max 200)
 *   - offset: pagination offset (default 0)
 */
export const GET = withRoute("/api/audit-logs", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const { take, skip } = parsePagination(req);

  const where: Record<string, unknown> = { workspaceId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginatedResponse(logs, total, take, skip);
});
