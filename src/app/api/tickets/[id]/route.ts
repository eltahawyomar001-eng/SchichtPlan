import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isEmployee,
  isManagement,
  requirePermission,
} from "@/lib/authorization";
import { log } from "@/lib/logger";
import { updateTicketSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  serverError,
  notFound,
  forbidden,
} from "@/lib/api-response";

// ─── GET  /api/tickets/[id] ────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "read");
    if (perm) return perm;

    const { id } = await params;

    const ticket = await prisma.ticket.findFirst({
      where: { id, workspaceId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
          // Filter internal comments for employees
          ...(isEmployee(user) ? { where: { isInternal: false } } : {}),
        },
      },
    });

    if (!ticket) return notFound("Ticket nicht gefunden");

    // EMPLOYEE can only see their own tickets
    if (isEmployee(user) && ticket.createdById !== user.id) {
      return forbidden("Kein Zugriff auf dieses Ticket");
    }

    return NextResponse.json(ticket);
  } catch (error) {
    log.error("Error fetching ticket:", { error });
    captureRouteError(error, { route: "/api/tickets/[id]", method: "GET" });
    return serverError("Fehler beim Laden des Tickets");
  }
}

// ─── PATCH  /api/tickets/[id] ──────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "update");
    if (perm) return perm;

    const { id } = await params;

    const parsed = validateBody(updateTicketSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const existing = await prisma.ticket.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) return notFound("Ticket nicht gefunden");

    // EMPLOYEE can only update their own tickets (subject/description only)
    if (isEmployee(user)) {
      if (existing.createdById !== user.id) {
        return forbidden("Kein Zugriff auf dieses Ticket");
      }
      // Employees cannot change status, priority, or assignment
      if (body.status || body.priority || body.assignedToId !== undefined) {
        return forbidden(
          "Nur Vorgesetzte können Status, Priorität oder Zuweisung ändern",
        );
      }
    }

    // Set resolvedAt/closedAt timestamps when status changes
    const data: Record<string, unknown> = { ...body };

    if (body.status === "GELOEST" && existing.status !== "GELOEST") {
      data.resolvedAt = new Date();
    }
    if (body.status === "GESCHLOSSEN" && existing.status !== "GESCHLOSSEN") {
      data.closedAt = new Date();
      if (!existing.resolvedAt) data.resolvedAt = new Date();
    }

    // Re-open: clear resolved/closed timestamps
    if (
      body.status &&
      ["OFFEN", "IN_BEARBEITUNG", "WARTEND"].includes(body.status)
    ) {
      if (existing.status === "GELOEST" || existing.status === "GESCHLOSSEN") {
        data.resolvedAt = null;
        data.closedAt = null;
      }
    }

    // Validate assignedToId belongs to the workspace
    if (body.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: body.assignedToId, workspaceId },
      });
      if (!assignee) {
        return notFound("Zugewiesener Benutzer nicht gefunden");
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    log.info("Ticket updated", {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: user.id,
      changes: Object.keys(body),
    });

    return NextResponse.json(ticket);
  } catch (error) {
    log.error("Error updating ticket:", { error });
    captureRouteError(error, { route: "/api/tickets/[id]", method: "PATCH" });
    return serverError("Fehler beim Aktualisieren des Tickets");
  }
}
