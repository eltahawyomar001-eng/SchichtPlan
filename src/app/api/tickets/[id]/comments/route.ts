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

    // EMPLOYEE can only comment on their own tickets
    if (isEmployee(user) && ticket.createdById !== user.id) {
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
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    // Auto-update ticket status if currently OFFEN and management replies
    if (ticket.status === "OFFEN" && isManagement(user)) {
      await prisma.ticket.update({
        where: { id },
        data: { status: "IN_BEARBEITUNG" },
      });
    }

    // Auto-reopen if ticket was resolved/closed and creator adds a comment
    if (
      ["GELOEST", "GESCHLOSSEN"].includes(ticket.status) &&
      ticket.createdById === user.id
    ) {
      await prisma.ticket.update({
        where: { id },
        data: {
          status: "OFFEN",
          resolvedAt: null,
          closedAt: null,
        },
      });
    }

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
