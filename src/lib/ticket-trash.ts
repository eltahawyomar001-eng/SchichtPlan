/**
 * Ticket soft-delete (Papierkorb / trash bin) and hard-purge helpers.
 *
 * Lifecycle:
 *   active → softDelete()  →  trash (deletedAt set)
 *   trash  → restore()     →  active (deletedAt cleared)
 *   trash  → purge()       →  permanently gone (blobs + rows wiped, usage
 *                              counter released)
 *
 * Storage accounting note: soft-deleted tickets still occupy bytes in
 * `WorkspaceUsage.ticketStorageBytesUsed`. Only `purgeTicket` decrements
 * the counter — so users hitting their quota while sitting on a full
 * trash bin get a contextual message telling them to purge or upgrade.
 */

import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { deleteBlob, releaseStorageUsage } from "@/lib/ticket-attachments";

export interface TicketStorageBreakdown {
  activeTickets: number;
  trashTickets: number;
  activeBytes: number;
  trashBytes: number;
  totalBytes: number;
}

/**
 * Single round-trip aggregation used by /api/billing/usage to split
 * active vs trash storage in the dashboard. Read-only.
 */
export async function getTicketStorageBreakdown(
  workspaceId: string,
): Promise<TicketStorageBreakdown> {
  const [activeCount, trashCount, activeAgg, trashAgg] =
    await prisma.$transaction([
      prisma.ticket.count({
        where: { workspaceId, deletedAt: null },
      }),
      prisma.ticket.count({
        where: { workspaceId, deletedAt: { not: null } },
      }),
      prisma.ticketAttachment.aggregate({
        where: { workspaceId, ticket: { deletedAt: null } },
        _sum: { fileSize: true },
      }),
      prisma.ticketAttachment.aggregate({
        where: { workspaceId, ticket: { deletedAt: { not: null } } },
        _sum: { fileSize: true },
      }),
    ]);

  const activeBytes = Number(activeAgg._sum.fileSize ?? BigInt(0));
  const trashBytes = Number(trashAgg._sum.fileSize ?? BigInt(0));

  return {
    activeTickets: activeCount,
    trashTickets: trashCount,
    activeBytes,
    trashBytes,
    totalBytes: activeBytes + trashBytes,
  };
}

/**
 * Move a ticket into the trash bin. Status and all related data stay
 * intact so restore is a single field flip.
 */
export async function softDeleteTicket(opts: {
  ticketId: string;
  workspaceId: string;
  actorId: string;
}): Promise<void> {
  await prisma.ticket.update({
    where: { id: opts.ticketId },
    data: {
      deletedAt: new Date(),
      deletedById: opts.actorId,
    },
  });
}

/**
 * Bring a trashed ticket back to the active pool. No-op if it wasn't
 * actually in the trash.
 */
export async function restoreTicket(opts: {
  ticketId: string;
  workspaceId: string;
}): Promise<void> {
  await prisma.ticket.update({
    where: { id: opts.ticketId },
    data: { deletedAt: null, deletedById: null },
  });
}

export interface PurgeResult {
  ticketId: string;
  attachmentsDeleted: number;
  bytesReleased: number;
  blobErrors: number;
}

/**
 * Permanently destroy a ticket: walk every attachment, delete each blob
 * from Vercel Blob, then `prisma.ticket.delete` (cascades comments +
 * events + attachment rows). The storage counter is decremented by the
 * total bytes that were attached.
 *
 * Blob deletion errors are logged but do not abort the purge — an
 * orphaned blob is recoverable; an undeleteable ticket would be a UX
 * dead-end.
 */
export async function purgeTicket(opts: {
  ticketId: string;
  workspaceId: string;
}): Promise<PurgeResult> {
  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticketId: opts.ticketId, workspaceId: opts.workspaceId },
    select: { id: true, fileUrl: true, fileSize: true },
  });

  let blobErrors = 0;
  let bytesReleased = 0;
  for (const a of attachments) {
    try {
      await deleteBlob(a.fileUrl);
    } catch (err) {
      blobErrors += 1;
      log.warn("[ticket-trash] blob delete failed during purge", {
        attachmentId: a.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    bytesReleased += Number(a.fileSize);
  }

  await prisma.ticket.delete({ where: { id: opts.ticketId } });

  if (bytesReleased > 0) {
    await releaseStorageUsage(opts.workspaceId, bytesReleased);
  }

  return {
    ticketId: opts.ticketId,
    attachmentsDeleted: attachments.length,
    bytesReleased,
    blobErrors,
  };
}
