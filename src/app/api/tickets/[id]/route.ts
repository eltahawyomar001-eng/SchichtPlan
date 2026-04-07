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
import {
  notifyTicketAssigned,
  notifyStatusChanged,
} from "@/lib/ticket-notifications";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

// ─── GET  /api/tickets/[id] ────────────────────────────────────
export const GET = withRoute(
  "/api/tickets/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "read");
    if (perm) return perm;

    const { id } = params;

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
  },
);

// ─── PATCH  /api/tickets/[id] ──────────────────────────────────
export const PATCH = withRoute(
  "/api/tickets/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "update");
    if (perm) return perm;

    const { id } = params;

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

    // Track SLA: resolvedAt on resolution/closure
    if (
      (effectiveStatus === "GESCHLOSSEN" || effectiveStatus === "GELOEST") &&
      (existing.status as string) !== "GESCHLOSSEN" &&
      (existing.status as string) !== "GELOEST" &&
      !existing.resolvedAt
    ) {
      data.resolvedAt = new Date();
    }

    // Re-open: clear closedAt and resolvedAt
    if (
      effectiveStatus !== "GESCHLOSSEN" &&
      (existing.status as string) === "GESCHLOSSEN"
    ) {
      data.closedAt = null;
      data.resolvedAt = null;
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

    createAuditLog({
      action: "UPDATE",
      entityType: "Ticket",
      entityId: ticket.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: body,
    });

    dispatchWebhook(workspaceId, "ticket.updated", {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ...body,
    }).catch(() => {});

    return NextResponse.json(ticket);
  },
);
