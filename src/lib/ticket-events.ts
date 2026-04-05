/**
 * Ticket Event Audit Trail Helper
 *
 * Creates immutable TicketEvent records for every significant action.
 * All events are fire-and-forget (non-blocking) unless inside a transaction.
 */

import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import type { TicketEventType } from "@prisma/client";

interface EventActor {
  id?: string | null;
  name: string;
}

interface CreateEventInput {
  ticketId: string;
  eventType: TicketEventType;
  actor: EventActor;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Create a single TicketEvent record (fire-and-forget).
 * Failures are logged but never thrown to avoid breaking the main flow.
 */
export async function createTicketEvent(
  input: CreateEventInput,
): Promise<void> {
  try {
    await prisma.ticketEvent.create({
      data: {
        ticketId: input.ticketId,
        eventType: input.eventType,
        actorId: input.actor.id ?? null,
        actorName: input.actor.name,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    log.error("Failed to create ticket event", {
      ticketId: input.ticketId,
      eventType: input.eventType,
      error,
    });
  }
}

/**
 * Log a ERSTELLT event when a ticket is created.
 */
export function logTicketCreated(
  ticketId: string,
  actor: EventActor,
  meta?: { ticketNumber?: string; ticketType?: string },
): void {
  void createTicketEvent({
    ticketId,
    eventType: "ERSTELLT",
    actor,
    metadata: meta,
  });
}

/**
 * Log a STATUS_GEAENDERT event when ticket status changes.
 */
export function logStatusChanged(
  ticketId: string,
  actor: EventActor,
  oldStatus: string,
  newStatus: string,
): void {
  void createTicketEvent({
    ticketId,
    eventType: "STATUS_GEAENDERT",
    actor,
    oldValue: oldStatus,
    newValue: newStatus,
  });
}

/**
 * Log a ZUGEWIESEN event when a ticket is assigned or reassigned.
 */
export function logTicketAssigned(
  ticketId: string,
  actor: EventActor,
  oldAssignee: string | null,
  newAssignee: string | null,
): void {
  void createTicketEvent({
    ticketId,
    eventType: "ZUGEWIESEN",
    actor,
    oldValue: oldAssignee,
    newValue: newAssignee,
  });
}

/**
 * Log an ANGESEHEN event when management first views a ticket.
 */
export function logTicketViewed(ticketId: string, actor: EventActor): void {
  void createTicketEvent({
    ticketId,
    eventType: "ANGESEHEN",
    actor,
  });
}

/**
 * Log a KOMMENTAR event when someone comments on a ticket.
 */
export function logCommentAdded(
  ticketId: string,
  actor: EventActor,
  meta?: { isInternal?: boolean },
): void {
  void createTicketEvent({
    ticketId,
    eventType: "KOMMENTAR",
    actor,
    metadata: meta,
  });
}

/**
 * Log a GESCHLOSSEN event when a ticket is closed.
 */
export function logTicketClosed(ticketId: string, actor: EventActor): void {
  void createTicketEvent({
    ticketId,
    eventType: "GESCHLOSSEN",
    actor,
  });
}
