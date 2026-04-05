import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isEmployee,
  isManagement,
  requirePermission,
} from "@/lib/authorization";
import { log } from "@/lib/logger";
import { createTicketCommentSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  serverError,
  notFound,
  forbidden,
} from "@/lib/api-response";
import { logCommentAdded, logStatusChanged } from "@/lib/ticket-events";
import {
  notifyCommentAdded,
  notifyStatusChanged,
} from "@/lib/ticket-notifications";

// ─── POST  /api/tickets/[id]/comments ──────────────────────────
export async function POST(
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

    const parsed = validateBody(createTicketCommentSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // Verify ticket exists and belongs to the workspace
    const ticket = await prisma.ticket.findFirst({
      where: { id, workspaceId },
    });

    if (!ticket) return notFound("Ticket nicht gefunden");

    // EMPLOYEE can only comment on their own tickets or tickets assigned to them
    if (
      isEmployee(user) &&
      ticket.createdById !== user.id &&
      ticket.assignedToId !== user.id
    ) {
      return forbidden("Kein Zugriff auf dieses Ticket");
    }

    // Only management can post internal comments
    const isInternal = body.isInternal && isManagement(user) ? true : false;

    const comment = await prisma.ticketComment.create({
      data: {
        content: body.content,
        isInternal,
        ticketId: id,
        authorId: user.id,
        authorName: user.name ?? "Unbekannt",
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    const actor = { id: user.id, name: user.name ?? "System" };

    // Auto-update ticket status if currently OFFEN and management replies
    if (ticket.status === "OFFEN" && isManagement(user)) {
      await prisma.ticket.update({
        where: { id },
        data: { status: "IN_BEARBEITUNG" },
      });
      logStatusChanged(ticket.id, actor, "OFFEN", "IN_BEARBEITUNG");
      notifyStatusChanged({
        actorId: user.id,
        workspaceId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        actorName: user.name ?? "System",
        newStatus: "IN_BEARBEITUNG",
        creatorId: ticket.createdById,
        assigneeId: ticket.assignedToId,
      });
    }

    // Auto-reopen if ticket was closed and creator adds a comment
    if (ticket.status === "GESCHLOSSEN" && ticket.createdById === user.id) {
      await prisma.ticket.update({
        where: { id },
        data: {
          status: "OFFEN",
          closedAt: null,
        },
      });
      logStatusChanged(ticket.id, actor, "GESCHLOSSEN", "OFFEN");
      notifyStatusChanged({
        actorId: user.id,
        workspaceId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        actorName: user.name ?? "System",
        newStatus: "OFFEN",
        creatorId: ticket.createdById,
        assigneeId: ticket.assignedToId,
      });
    }

    // Audit trail
    logCommentAdded(ticket.id, actor, { isInternal });

    // Notify creator + assignee about the new comment
    notifyCommentAdded({
      authorId: user.id,
      workspaceId,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      authorName: user.name ?? "System",
      isInternal,
      creatorId: ticket.createdById,
      assigneeId: ticket.assignedToId,
    });

    log.info("Ticket comment added", {
      ticketId: id,
      commentId: comment.id,
      userId: user.id,
      isInternal,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    log.error("Error creating ticket comment:", { error });
    captureRouteError(error, {
      route: "/api/tickets/[id]/comments",
      method: "POST",
    });
    return serverError("Fehler beim Erstellen des Kommentars");
  }
}
