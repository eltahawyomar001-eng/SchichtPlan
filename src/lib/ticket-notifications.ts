/**
 * Ticket Notification Helper
 *
 * Creates in-app notifications for ticket events using the existing
 * Notification model and dispatches the matching email + push.
 *
 * IMPORTANT — serverless lifetime:
 * Every exported function returns a `Promise<void>` and MUST be awaited
 * inside Next.js `after()` at the call site. Bare fire-and-forget (`void
 * notifyTicketAssigned(...)`) is NOT safe on Vercel: once the route returns
 * its response the function instance is frozen/terminated and any unawaited
 * background promise — including the assignee email — is dropped. That was
 * the root cause of assignment emails intermittently never arriving.
 */

import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { dispatchExternalNotification } from "@/lib/notifications";

// ─── Helpers ────────────────────────────────────────────────────

async function createNotificationSafe(data: {
  userId: string;
  workspaceId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  // The in-app notification row and the external dispatch (email + push) are
  // INDEPENDENT side effects. Previously they shared one try-block, so a throw
  // in `notification.create` skipped the email entirely. Run them separately
  // and capture each failure to Sentry so nothing fails silently again.
  const inApp = prisma.notification
    .create({ data })
    .then(() => undefined)
    .catch((error) => {
      log.error("Failed to create in-app ticket notification", {
        userId: data.userId,
        type: data.type,
        error,
      });
      captureRouteError(error, {
        route: "lib/ticket-notifications#notification.create",
        method: "DISPATCH",
        userId: data.userId,
        workspaceId: data.workspaceId,
        extra: { type: data.type },
      });
    });

  const external = dispatchExternalNotification({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link ?? null,
  }).catch((error) => {
    log.error("Failed to dispatch ticket email/push notification", {
      userId: data.userId,
      type: data.type,
      error,
    });
    captureRouteError(error, {
      route: "lib/ticket-notifications#dispatchExternal",
      method: "DISPATCH",
      userId: data.userId,
      workspaceId: data.workspaceId,
      extra: { type: data.type },
    });
  });

  await Promise.allSettled([inApp, external]);
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
}): Promise<void> {
  return createNotificationSafe({
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
}): Promise<void> {
  const statusLabel = STATUS_LABELS[opts.newStatus] ?? opts.newStatus;
  const recipientIds = new Set<string>();

  if (opts.creatorId && opts.creatorId !== opts.actorId) {
    recipientIds.add(opts.creatorId);
  }
  if (opts.assigneeId && opts.assigneeId !== opts.actorId) {
    recipientIds.add(opts.assigneeId);
  }

  return Promise.allSettled(
    [...recipientIds].map((userId) =>
      createNotificationSafe({
        userId,
        workspaceId: opts.workspaceId,
        type: "TICKET_STATUS_CHANGED",
        title: `Ticket ${opts.ticketNumber}: ${statusLabel}`,
        message: `${opts.actorName} hat den Status von „${opts.subject}" auf „${statusLabel}" geändert.`,
        link: `/tickets/${opts.ticketId}`,
      }),
    ),
  ).then(() => undefined);
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
}): Promise<void> {
  const recipientIds = new Set<string>();

  // Internal notes should NOT notify the ticket creator (they're internal)
  if (!opts.isInternal && opts.creatorId && opts.creatorId !== opts.authorId) {
    recipientIds.add(opts.creatorId);
  }

  // Always notify assignee (they are management, can see internal notes)
  if (opts.assigneeId && opts.assigneeId !== opts.authorId) {
    recipientIds.add(opts.assigneeId);
  }

  return Promise.allSettled(
    [...recipientIds].map((userId) =>
      createNotificationSafe({
        userId,
        workspaceId: opts.workspaceId,
        type: "TICKET_COMMENT",
        title: `Neuer Kommentar: ${opts.ticketNumber}`,
        message: `${opts.authorName} hat einen Kommentar zu „${opts.subject}" hinzugefügt.`,
        link: `/tickets/${opts.ticketId}`,
      }),
    ),
  ).then(() => undefined);
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
}): Promise<void> {
  return (async () => {
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

      // Dispatch email + push for each manager
      await Promise.allSettled(
        managers.map((m) =>
          dispatchExternalNotification({
            userId: m.id,
            type: "TICKET_CREATED",
            title: `Neues Ticket: ${opts.ticketNumber}`,
            message: `${opts.creatorName} hat ein neues Ticket erstellt: „${opts.subject}"`,
            link: `/tickets/${opts.ticketId}`,
          }),
        ),
      );
    } catch (error) {
      log.error("Failed to notify managers of new ticket", {
        ticketId: opts.ticketId,
        error,
      });
      captureRouteError(error, {
        route: "lib/ticket-notifications#notifyNewTicket",
        method: "DISPATCH",
        workspaceId: opts.workspaceId,
        extra: { ticketId: opts.ticketId },
      });
    }
  })();
}
