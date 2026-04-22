import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { serverError, notFound } from "@/lib/api-response";

/**
 * GET  /api/tickets/external/[token]
 *
 * Public endpoint (no authentication). Returns limited ticket information
 * for external submitters using their unique tracking token.
 *
 * Only exposes: ticketNumber, subject, status, category, createdAt,
 * closedAt, and non-internal comments with authorName only.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return notFound("Ticket nicht gefunden");
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        externalToken: token,
        ticketType: "EXTERN",
      },
      select: {
        id: true,
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
        attachments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            uploaderName: true,
            createdAt: true,
            commentId: true,
          },
        },
      },
    });

    if (!ticket) {
      return notFound("Ticket nicht gefunden");
    }

    // Serialize BigInt fileSize for JSON
    const serialized = {
      ...ticket,
      attachments: ticket.attachments.map((a) => ({
        ...a,
        fileSize: a.fileSize.toString(),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    log.error("Error fetching external ticket:", { error });
    captureRouteError(error, {
      route: "/api/tickets/external/[token]",
      method: "GET",
    });
    return serverError("Fehler beim Laden des Tickets");
  }
}
