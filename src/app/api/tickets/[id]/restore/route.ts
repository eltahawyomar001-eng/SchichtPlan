import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireAuth, notFound, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireTicketingAddon } from "@/lib/ticketing-addon";
import { restoreTicket } from "@/lib/ticket-trash";
import { logTicketRestored } from "@/lib/ticket-events";

/**
 * POST /api/tickets/[id]/restore
 *
 * Bring a soft-deleted (trashed) ticket back to the active pool. The
 * status field is untouched — a ticket trashed while OFFEN comes back
 * as OFFEN, GESCHLOSSEN tickets come back GESCHLOSSEN.
 *
 * Same permission as DELETE (tickets.delete) since this reverses a
 * destructive action that only OWNER/ADMIN can take.
 */
export const POST = withRoute(
  "/api/tickets/[id]/restore",
  "POST",
  async (_req, context) => {
    try {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
      const { user, workspaceId } = auth;

      const perm = requirePermission(user, "tickets", "delete");
      if (perm) return perm;

      const addonRequired = await requireTicketingAddon(workspaceId);
      if (addonRequired) return addonRequired;

      const { id } = await context!.params;

      const ticket = await prisma.ticket.findFirst({
        where: { id, workspaceId },
        select: { id: true, deletedAt: true, ticketNumber: true },
      });
      if (!ticket) return notFound("Ticket nicht gefunden");
      if (!ticket.deletedAt) {
        return NextResponse.json({ ok: true, alreadyActive: true });
      }

      await restoreTicket({ ticketId: id, workspaceId });
      logTicketRestored(id, { id: user.id, name: user.name ?? "System" });

      log.info("Ticket restored from trash", {
        ticketId: id,
        ticketNumber: ticket.ticketNumber,
        userId: user.id,
      });

      return NextResponse.json({ ok: true, restored: true });
    } catch (error) {
      log.error("Error restoring ticket:", { error });
      captureRouteError(error, {
        route: "/api/tickets/[id]/restore",
        method: "POST",
      });
      return serverError("Fehler beim Wiederherstellen des Tickets");
    }
  },
);
