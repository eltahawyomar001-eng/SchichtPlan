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
import {
  logStatusChanged,
  logTicketAssigned,
  logTicketViewed,
  logTicketClosed,
} from "@/lib/ticket-events";

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

    // EMPLOYEE can only see their own tickets or tickets assigned to them
    if (
      isEmployee(user) &&
      ticket.createdById !== user.id &&
      ticket.assignedToId !== user.id
    ) {
      return forbidden("Kein Zugriff auf dieses Ticket");
    }

    // Track first-viewed-at for management users
    if (isManagement(user) && !ticket.firstViewedAt) {
      void prisma.ticket
        .update({
          where: { id },
          data: {
            firstViewedAt: new Date(),
            firstViewedById: user.id,
          },
        })
        .catch(() => {});

      logTicketViewed(ticket.id, { id: user.id, name: user.name ?? "System" });
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
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    if (!existing) return notFound("Ticket nicht gefunden");

    // EMPLOYEE can only update their own tickets (subject/description only)
    if (isEmployee(user)) {
      if (
        existing.createdById !== user.id &&
        existing.assignedToId !== user.id
      ) {
        return forbidden("Kein Zugriff auf dieses Ticket");
      }
      // Employees cannot change status, priority, or assignment
      if (body.status || body.priority || body.assignedToId !== undefined) {
        return forbidden(
          "Nur Vorgesetzte können Status, Priorität oder Zuweisung ändern",
        );
      }
    }

    const data: Record<string, unknown> = { ...body };
    const actor = { id: user.id, name: user.name ?? "System" };

    // Set closedAt timestamp when closing
    if (body.status === "GESCHLOSSEN" && existing.status !== "GESCHLOSSEN") {
      data.closedAt = new Date();
    }

    // Re-open: clear closedAt
    if (
      body.status &&
      ["OFFEN", "IN_BEARBEITUNG"].includes(body.status) &&
      existing.status === "GESCHLOSSEN"
    ) {
      data.closedAt = null;
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

    // Audit trail: status change
    if (body.status && body.status !== existing.status) {
      logStatusChanged(ticket.id, actor, existing.status, body.status);
      if (body.status === "GESCHLOSSEN") {
        logTicketClosed(ticket.id, actor);
      }
    }

    // Audit trail: assignment change
    if (
      body.assignedToId !== undefined &&
      body.assignedToId !== existing.assignedToId
    ) {
      logTicketAssigned(
        ticket.id,
        actor,
        existing.assignedTo?.name ?? existing.assignedToId,
        ticket.assignedTo?.name ?? body.assignedToId,
      );
    }

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
