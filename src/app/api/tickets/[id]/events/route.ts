import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  serverError,
  notFound,
  forbidden,
} from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

// ─── GET  /api/tickets/[id]/events ─────────────────────────────
export const GET = withRoute(
  "/api/tickets/[id]/events",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "read");
    if (perm) return perm;

    const { id } = params;

    // Verify the ticket exists and belongs to the workspace
    const ticket = await prisma.ticket.findFirst({
      where: { id, workspaceId },
      select: { id: true, createdById: true, assignedToId: true },
    });

    if (!ticket) return notFound("Ticket nicht gefunden");

    // EMPLOYEE can only see events on their own/assigned tickets
    if (
      isEmployee(user) &&
      ticket.createdById !== user.id &&
      ticket.assignedToId !== user.id
    ) {
      return forbidden("Kein Zugriff auf dieses Ticket");
    }

    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(events);
  },
);
