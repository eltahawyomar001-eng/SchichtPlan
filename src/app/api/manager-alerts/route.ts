import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireManagement } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";

/**
 * GET /api/manager-alerts
 *
 * List all manager alerts for the workspace.
 * Supports filtering by severity and acknowledged status.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).managerAlert.findMany({
        where,
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).managerAlert.count({ where }),
    ]);

    return paginatedResponse(alerts, total, take, skip);
  } catch (error) {
    log.error("Error fetching manager alerts:", { error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}
