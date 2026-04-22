/**
 * Ticket Attachment — DELETE single attachment.
 *
 * DELETE /api/tickets/[id]/attachments/[attachmentId]
 *
 * RBAC: Management can delete any attachment. Employees can delete only
 * attachments they themselves uploaded.
 *
 * Side-effects:
 *   • Deletes the underlying Vercel blob (best-effort).
 *   • Decrements WorkspaceUsage.ticketStorageBytesUsed.
 *   • Audit event is NOT emitted on delete (kept consistent with other ticket
 *     delete actions which rely on row-level history).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isEmployee,
  isManagement,
  requirePermission,
} from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  serverError,
  notFound,
  forbidden,
} from "@/lib/api-response";
import { requireTicketingAddon } from "@/lib/ticketing-addon";
import { deleteBlob, releaseStorageUsage } from "@/lib/ticket-attachments";

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; attachmentId: string }>;
  },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "update");
    if (perm) return perm;

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const { id, attachmentId } = await params;

    const attachment = await prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId: id, workspaceId },
    });
    if (!attachment) return notFound("Anhang nicht gefunden");

    // Permission: management OR uploader themselves
    if (!isManagement(user) && attachment.uploadedById !== user.id) {
      return forbidden("Kein Recht, diesen Anhang zu löschen");
    }

    // For employees, additionally enforce ownership of the parent ticket
    if (isEmployee(user)) {
      const ticket = await prisma.ticket.findFirst({
        where: { id, workspaceId },
        select: { createdById: true, assignedToId: true },
      });
      if (
        !ticket ||
        (ticket.createdById !== user.id && ticket.assignedToId !== user.id)
      ) {
        return forbidden("Kein Zugriff auf dieses Ticket");
      }
    }

    const fileSize = attachment.fileSize;
    const fileUrl = attachment.fileUrl;

    await prisma.ticketAttachment.delete({ where: { id: attachmentId } });
    await releaseStorageUsage(workspaceId, fileSize);
    await deleteBlob(fileUrl);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error("[ticket attachment DELETE] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/[id]/attachments/[attachmentId]",
      method: "DELETE",
    });
    return serverError("Anhang konnte nicht gelöscht werden");
  }
}
