import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

// ─── GET  /api/tickets/stats ────────────────────────────────────
export const GET = withRoute("/api/tickets/stats", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const perm = requirePermission(user, "tickets", "read");
  if (perm) return perm;

  const baseWhere: Record<string, unknown> = { workspaceId };

  // EMPLOYEE can see stats for their own + assigned tickets
  if (isEmployee(user)) {
    baseWhere.OR = [{ createdById: user.id }, { assignedToId: user.id }];
  }

  const [total, open, inProgress, closed, byCategory, byPriority] =
    await Promise.all([
      prisma.ticket.count({ where: baseWhere }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "OFFEN" },
      }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "IN_BEARBEITUNG" },
      }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "GESCHLOSSEN" },
      }),
      prisma.ticket.groupBy({
        by: ["category"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ["priority"],
        where: {
          ...baseWhere,
          status: { not: "GESCHLOSSEN" },
        },
        _count: { _all: true },
      }),
    ]);

  return NextResponse.json({
    total,
    byStatus: {
      OFFEN: open,
      IN_BEARBEITUNG: inProgress,
      GESCHLOSSEN: closed,
    },
    byCategory: Object.fromEntries(
      byCategory.map((g) => [g.category, g._count._all]),
    ),
    byPriority: Object.fromEntries(
      byPriority.map((g) => [g.priority, g._count._all]),
    ),
  });
});
