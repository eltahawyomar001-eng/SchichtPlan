/**
 * Ticket Notification Helper
 *
 * Creates in-app notifications for ticket events using the existing
 * Notification model. All functions are fire-and-forget to avoid
 * blocking the main request flow.
 */

import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

// ─── Helpers ────────────────────────────────────────────────────

async function createNotificationSafe(data: {
  userId: string;
  workspaceId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({ data });
  } catch (error) {
    log.error("Failed to create ticket notification", {
      userId: data.userId,
      type: data.type,
      error,
    });
  }
}

// ─── Assignment Notification ────────────────────────────────────

/**
 * Notify the assignee that a ticket has been assigned to them.
 */
export function notifyTicketAssigned(opts: {
  assigneeId: string;
  workspaceId: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  assignedByName: string;
}): void {
  void createNotificationSafe({
    userId: opts.assigneeId,
    workspaceId: opts.workspaceId,
    type: "TICKET_ASSIGNED",
    title: `Ticket ${opts.ticketNumber} zugewiesen`,
    message: `${opts.assignedByName} hat Ihnen das Ticket „${opts.subject}" zugewiesen.`,
    link: `/tickets/${opts.ticketId}`,
  });
}

// ─── Status Change Notification ─────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  GESCHLOSSEN: "Geschlossen",
};

/**
 * Notify relevant parties when ticket status changes.
 * - Creator is notified (unless they are the one who changed it)
 * - Assignee is notified (unless they are the one who changed it)
 */
export function notifyStatusChanged(opts: {
  actorId: string;
  workspaceId: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  actorName: string;
  newStatus: string;
  creatorId: string | null;
  assigneeId: string | null;
}): void {
  const statusLabel = STATUS_LABELS[opts.newStatus] ?? opts.newStatus;
  const recipientIds = new Set<string>();

  if (opts.creatorId && opts.creatorId !== opts.actorId) {
    recipientIds.add(opts.creatorId);
  }
  if (opts.assigneeId && opts.assigneeId !== opts.actorId) {
    recipientIds.add(opts.assigneeId);
  }

  for (const userId of recipientIds) {
    void createNotificationSafe({
      userId,
      workspaceId: opts.workspaceId,
      type: "TICKET_STATUS_CHANGED",
      title: `Ticket ${opts.ticketNumber}: ${statusLabel}`,
      message: `${opts.actorName} hat den Status von „${opts.subject}" auf „${statusLabel}" geändert.`,
      link: `/tickets/${opts.ticketId}`,
    });
  }
}

// ─── Comment Notification ───────────────────────────────────────

/**
 * Notify relevant parties when a comment is added.
 * - Creator gets notified (unless they wrote the comment)
 * - Assignee gets notified (unless they wrote the comment)
 * - Internal notes only notify management (assignee), not the creator
 */
export function notifyCommentAdded(opts: {
  authorId: string;
  workspaceId: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  authorName: string;
  isInternal: boolean;
  creatorId: string | null;
  assigneeId: string | null;
}): void {
  const recipientIds = new Set<string>();

  // Internal notes should NOT notify the ticket creator (they're internal)
  if (!opts.isInternal && opts.creatorId && opts.creatorId !== opts.authorId) {
    recipientIds.add(opts.creatorId);
  }

  // Always notify assignee (they are management, can see internal notes)
  if (opts.assigneeId && opts.assigneeId !== opts.authorId) {
    recipientIds.add(opts.assigneeId);
  }

  for (const userId of recipientIds) {
    void createNotificationSafe({
      userId,
      workspaceId: opts.workspaceId,
      type: "TICKET_COMMENT",
      title: `Neuer Kommentar: ${opts.ticketNumber}`,
      message: `${opts.authorName} hat einen Kommentar zu „${opts.subject}" hinzugefügt.`,
      link: `/tickets/${opts.ticketId}`,
    });
  }
}

// ─── New Ticket Notification ────────────────────────────────────

/**
 * Notify all managers/admins/owners in the workspace that a new ticket
 * has been created (so someone can pick it up).
 */
export function notifyNewTicket(opts: {
  creatorId: string | null;
  workspaceId: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  creatorName: string;
}): void {
  void (async () => {
    try {
      // Fetch all management users in the workspace
      const managers = await prisma.user.findMany({
        where: {
          workspaceId: opts.workspaceId,
          role: { in: ["OWNER", "ADMIN", "MANAGER"] },
          ...(opts.creatorId ? { id: { not: opts.creatorId } } : {}),
        },
        select: { id: true },
      });

      if (managers.length === 0) return;

      await prisma.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          workspaceId: opts.workspaceId,
          type: "TICKET_CREATED",
          title: `Neues Ticket: ${opts.ticketNumber}`,
          message: `${opts.creatorName} hat ein neues Ticket erstellt: „${opts.subject}"`,
          link: `/tickets/${opts.ticketId}`,
        })),
      });
    } catch (error) {
      log.error("Failed to notify managers of new ticket", {
        ticketId: opts.ticketId,
        error,
      });
    }
  })();
}
