import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError } from "@/lib/api-response";

// ─── GET  /api/tickets/stats ────────────────────────────────────
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "read");
    if (perm) return perm;

    const baseWhere: Record<string, unknown> = { workspaceId };

    // EMPLOYEE can only see stats for their own tickets
    if (isEmployee(user)) {
      baseWhere.createdById = user.id;
    }

    const [
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      byCategory,
      byPriority,
    ] = await Promise.all([
      prisma.ticket.count({ where: baseWhere }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "OFFEN" },
      }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "IN_BEARBEITUNG" },
      }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "WARTEND" },
      }),
      prisma.ticket.count({
        where: { ...baseWhere, status: "GELOEST" },
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
          status: { notIn: ["GELOEST", "GESCHLOSSEN"] },
        },
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      total,
      byStatus: {
        OFFEN: open,
        IN_BEARBEITUNG: inProgress,
        WARTEND: waiting,
        GELOEST: resolved,
        GESCHLOSSEN: closed,
      },
      byCategory: Object.fromEntries(
        byCategory.map((g) => [g.category, g._count._all]),
      ),
      byPriority: Object.fromEntries(
        byPriority.map((g) => [g.priority, g._count._all]),
      ),
    });
  } catch (error) {
    log.error("Error fetching ticket stats:", { error });
    captureRouteError(error, {
      route: "/api/tickets/stats",
      method: "GET",
    });
    return serverError("Fehler beim Laden der Ticket-Statistiken");
  }
}
