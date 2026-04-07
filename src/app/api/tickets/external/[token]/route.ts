import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { serverError, notFound } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

/**
 * GET  /api/tickets/external/[token]
 *
 * Public endpoint (no authentication). Returns limited ticket information
 * for external submitters using their unique tracking token.
 *
 * Only exposes: ticketNumber, subject, status, category, createdAt,
 * closedAt, and non-internal comments with authorName only.
 */
export const GET = withRoute(
  "/api/tickets/external/[token]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const { token } = params;

    if (!token || token.length < 10) {
      return notFound("Ticket nicht gefunden");
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        externalToken: token,
        ticketType: "EXTERN",
      },
      select: {
        ticketNumber: true,
        subject: true,
        description: true,
        status: true,
        category: true,
        location: true,
        externalSubmitterName: true,
        createdAt: true,
        closedAt: true,
        comments: {
          where: { isInternal: false },
          select: {
            id: true,
            content: true,
            authorName: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return notFound("Ticket nicht gefunden");
    }

    return NextResponse.json(ticket);
  },
);
