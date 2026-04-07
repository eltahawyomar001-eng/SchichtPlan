import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { createExternalTicketSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import { serverError, badRequest, notFound } from "@/lib/api-response";
import { logTicketCreated } from "@/lib/ticket-events";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * POST  /api/tickets/external
 *
 * Public endpoint (no authentication). Creates a ticket from an external
 * submitter. Requires `workspaceSlug` in query params to scope the ticket.
 *
 * Returns the created ticket with its `externalToken` so the submitter
 * can track the status via the public page.
 */
export const POST = withRoute("/api/tickets/external", "POST", async (req) => {
  const { searchParams } = new URL(req.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return badRequest("Workspace-Parameter fehlt");
  }

  // Resolve workspace
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });

  if (!workspace) {
    return notFound("Workspace nicht gefunden");
  }

  const parsed = validateBody(createExternalTicketSchema, await req.json());
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  // Generate ticket number
  const year = new Date().getFullYear();
  const lastTicket = await prisma.ticket.findFirst({
    where: {
      workspaceId: workspace.id,
      ticketNumber: { startsWith: `TK-${year}-` },
    },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  let nextNumber = 1;
  if (lastTicket) {
    const parts = lastTicket.ticketNumber.split("-");
    nextNumber = parseInt(parts[2], 10) + 1;
  }

  const ticketNumber = `TK-${year}-${String(nextNumber).padStart(4, "0")}`;
  const externalToken = randomUUID();

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      ticketType: "EXTERN",
      subject: body.subject,
      description: body.description,
      category: body.category,
      priority: "MITTEL",
      location: body.location || null,
      externalSubmitterName: body.name,
      externalToken,
      createdById: null,
      workspaceId: workspace.id,
    },
    select: {
      id: true,
      ticketNumber: true,
      externalToken: true,
      subject: true,
      status: true,
      createdAt: true,
    },
  });

  // Audit trail
  logTicketCreated(
    ticket.id,
    { id: null, name: body.name },
    { ticketNumber: ticket.ticketNumber, ticketType: "EXTERN" },
  );

  createAuditLog({
    action: "CREATE",
    entityType: "Ticket",
    entityId: ticket.id,
    workspaceId: workspace.id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      ticketType: "EXTERN",
      submitterName: body.name,
    },
  });

  dispatchWebhook(workspace.id, "ticket.created", {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketType: "EXTERN",
  }).catch(() => {});

  log.info("External ticket created", {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    workspaceId: workspace.id,
    submitterName: body.name,
  });

  return NextResponse.json(
    {
      ticketNumber: ticket.ticketNumber,
      token: ticket.externalToken,
      status: ticket.status,
      createdAt: ticket.createdAt,
    },
    { status: 201 },
  );
});
