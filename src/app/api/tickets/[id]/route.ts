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
import { requireTicketingAddon } from "@/lib/ticketing-addon";
import {
  logStatusChanged,
  logTicketAssigned,
  logTicketViewed,
  logTicketClosed,
  logTicketTrashed,
} from "@/lib/ticket-events";
import { softDeleteTicket, purgeTicket } from "@/lib/ticket-trash";
import {
  notifyTicketAssigned,
  notifyStatusChanged,
} from "@/lib/ticket-notifications";

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

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

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
        attachments: {
          orderBy: { createdAt: "asc" },
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
        .catch((err) => log.warn("[dispatch] fire-and-forget failed", { err }));

      logTicketViewed(ticket.id, { id: user.id, name: user.name ?? "System" });
    }

    // Serialize BigInt fileSize for JSON
    const serialized = {
      ...ticket,
      attachments: ticket.attachments.map((a) => ({
        ...a,
        fileSize: a.fileSize.toString(),
      })),
    };

    return NextResponse.json(serialized);
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

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

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

    // ── RBAC for EMPLOYEE role ──────────────────────────────────
    if (isEmployee(user)) {
      const isCreator = existing.createdById === user.id;
      const isAssignee = existing.assignedToId === user.id;

      if (!isCreator && !isAssignee) {
        return forbidden("Kein Zugriff auf dieses Ticket");
      }

      // Assignees (even employees) can change STATUS only
      if (isAssignee) {
        if (body.priority || body.assignedToId !== undefined) {
          return forbidden(
            "Nur Vorgesetzte können Priorität oder Zuweisung ändern",
          );
        }
      } else {
        // Pure creators (not assignee) cannot change status/priority/assignment
        if (body.status || body.priority || body.assignedToId !== undefined) {
          return forbidden(
            "Nur Vorgesetzte oder der Bearbeiter können Status ändern",
          );
        }
      }
    }

    const data: Record<string, unknown> = { ...body };
    const actor = { id: user.id, name: user.name ?? "System" };

    // ── Auto-transition: OFFEN → IN_BEARBEITUNG on assignment ──
    if (
      body.assignedToId &&
      body.assignedToId !== existing.assignedToId &&
      existing.status === "OFFEN" &&
      !body.status
    ) {
      data.status = "IN_BEARBEITUNG";
    }

    // Set closedAt timestamp when closing
    const effectiveStatus = (data.status as string) ?? existing.status;
    if (
      effectiveStatus === "GESCHLOSSEN" &&
      existing.status !== "GESCHLOSSEN"
    ) {
      data.closedAt = new Date();
    }

    // Re-open: clear closedAt
    if (
      effectiveStatus !== "GESCHLOSSEN" &&
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

    // ── Audit trail + Notifications: status change ──────────────
    const finalStatus = (data.status as string) ?? null;
    if (finalStatus && finalStatus !== existing.status) {
      logStatusChanged(ticket.id, actor, existing.status, finalStatus);
      if (finalStatus === "GESCHLOSSEN") {
        logTicketClosed(ticket.id, actor);
      }

      notifyStatusChanged({
        actorId: user.id,
        workspaceId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        actorName: user.name ?? "System",
        newStatus: finalStatus,
        creatorId: existing.createdById,
        assigneeId: ticket.assignedToId,
      });
    }

    // ── Audit trail + Notifications: assignment change ──────────
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

      // Notify the new assignee
      if (body.assignedToId) {
        notifyTicketAssigned({
          assigneeId: body.assignedToId,
          workspaceId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          assignedByName: user.name ?? "System",
        });
      }
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

// ─── DELETE  /api/tickets/[id] ─────────────────────────────────
// Default behaviour is **soft delete** — the ticket moves to the workspace's
// trash bin (Papierkorb). Add `?purge=true` to permanently destroy the
// ticket along with its blob attachments and release storage usage.
// Permission: tickets.delete is restricted to OWNER and ADMIN
// (see permissionMatrix in /lib/authorization.ts).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "delete");
    if (perm) return perm;

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const { id } = await params;
    const url = new URL(req.url);
    const purge = url.searchParams.get("purge") === "true";

    const existing = await prisma.ticket.findFirst({
      where: { id, workspaceId },
      select: { id: true, ticketNumber: true, deletedAt: true },
    });
    if (!existing) return notFound("Ticket nicht gefunden");

    if (purge) {
      // Hard delete: walk attachments, delete blobs, decrement storage
      // counter, then cascade-delete the row. Only allowed from the
      // trash bin so users can't accidentally bypass the soft step.
      if (!existing.deletedAt) {
        return NextResponse.json(
          {
            error: "PURGE_REQUIRES_TRASH",
            message:
              "Bitte zuerst in den Papierkorb verschieben, dann endgültig löschen.",
          },
          { status: 409 },
        );
      }
      const result = await purgeTicket({ ticketId: id, workspaceId });
      log.info("Ticket purged", {
        ticketNumber: existing.ticketNumber,
        userId: user.id,
        ...result,
      });
      return NextResponse.json({ ok: true, purged: true, ...result });
    }

    if (existing.deletedAt) {
      // Already in trash — DELETE is idempotent here.
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }

    await softDeleteTicket({
      ticketId: id,
      workspaceId,
      actorId: user.id,
    });
    logTicketTrashed(id, { id: user.id, name: user.name ?? "System" });

    log.info("Ticket moved to trash", {
      ticketId: id,
      ticketNumber: existing.ticketNumber,
      userId: user.id,
    });

    return NextResponse.json({ ok: true, trashed: true });
  } catch (error) {
    log.error("Error deleting ticket:", { error });
    captureRouteError(error, { route: "/api/tickets/[id]", method: "DELETE" });
    return serverError("Fehler beim Löschen des Tickets");
  }
}
