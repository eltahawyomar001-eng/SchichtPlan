import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isEmployee,
  isManagement,
  requirePermission,
} from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createTicketSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError } from "@/lib/api-response";

// ─── GET  /api/tickets ──────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "tickets", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const assignedToId = searchParams.get("assignedToId");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { workspaceId };

    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;

    // EMPLOYEE can only see their own tickets
    if (isEmployee(user)) {
      where.createdById = user.id;
    }

    // Text search on subject and ticketNumber
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { ticketNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const { take, skip } = parsePagination(req);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.ticket.count({ where }),
    ]);

    return paginatedResponse(tickets, total, take, skip);
  } catch (error) {
    log.error("Error fetching tickets:", { error });
    captureRouteError(error, { route: "/api/tickets", method: "GET" });
    return serverError("Fehler beim Laden der Tickets");
  }
}

// ─── POST  /api/tickets ─────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "tickets", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createTicketSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // Generate human-readable ticket number: TK-YYYY-NNNN
    const year = new Date().getFullYear();
    const lastTicket = await prisma.ticket.findFirst({
      where: {
        workspaceId,
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

    // Auto-assign to management if not an employee creating
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject: body.subject,
        description: body.description,
        category: body.category,
        priority: body.priority ?? "MITTEL",
        createdById: user.id,
        workspaceId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    log.info("Ticket created", {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: user.id,
      workspaceId,
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    log.error("Error creating ticket:", { error });
    captureRouteError(error, { route: "/api/tickets", method: "POST" });
    return serverError("Fehler beim Erstellen des Tickets");
  }
}
