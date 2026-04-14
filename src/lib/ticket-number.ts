/**
 * Ticket Number Generator
 *
 * Generates workspace-scoped sequential ticket numbers: TK-YYYY-NNNN.
 * Includes retry logic to handle race conditions when two requests
 * try to create a ticket simultaneously in the same workspace.
 */

import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

const MAX_RETRIES = 3;

/**
 * Generate the next ticket number for a workspace.
 * Format: TK-YYYY-NNNN (zero-padded to 4 digits).
 *
 * Queries the highest existing number for the current year within
 * the workspace and increments by 1.
 */
export async function generateTicketNumber(
  workspaceId: string,
): Promise<string> {
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

  return `TK-${year}-${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Create a ticket with automatic ticket number generation and retry.
 *
 * If a unique constraint violation occurs (race condition — two requests
 * generated the same number), it retries with the next available number.
 *
 * @param workspaceId - The workspace to create the ticket in
 * @param data - Ticket data without ticketNumber and workspaceId (both are added automatically)
 * @param options - Prisma select/include options
 * @returns The created ticket
 */
export async function createTicketWithNumber<T>(
  workspaceId: string,
  data: Omit<Prisma.TicketUncheckedCreateInput, "ticketNumber" | "workspaceId">,
  options?: { select?: Prisma.TicketSelect; include?: Prisma.TicketInclude },
): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const ticketNumber = await generateTicketNumber(workspaceId);

    try {
      const createArgs: Prisma.TicketCreateArgs = {
        data: { ...data, ticketNumber, workspaceId },
      };
      if (options?.select) createArgs.select = options.select;
      if (options?.include) createArgs.include = options.include;

      const ticket = await prisma.ticket.create(createArgs);
      return ticket as T;
    } catch (error: unknown) {
      // Check for unique constraint violation (P2002 in Prisma)
      const isPrismaUniqueError =
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002";

      if (isPrismaUniqueError && attempt < MAX_RETRIES - 1) {
        log.warn("Ticket number collision, retrying", {
          ticketNumber,
          workspaceId,
          attempt: attempt + 1,
        });
        continue;
      }
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("Failed to generate unique ticket number after retries");
}
