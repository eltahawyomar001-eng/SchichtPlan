import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagement } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/manager-alerts
 *
 * List all manager alerts for the workspace.
 * Supports filtering by severity and acknowledged status.
 */
export const GET = withRoute("/api/manager-alerts", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const forbidden = requireManagement(user);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get("severity");
  const acknowledged = searchParams.get("acknowledged");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { workspaceId };
  if (severity) where.severity = severity;
  if (acknowledged !== null && acknowledged !== undefined) {
    where.acknowledged = acknowledged === "true";
  }

  const { take, skip } = parsePagination(req);

  const [alerts, total] = await Promise.all([
    prisma.managerAlert.findMany({
      where,
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.managerAlert.count({ where }),
  ]);

  return paginatedResponse(alerts, total, take, skip);
});
