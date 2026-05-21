import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SosEventType =
  | "CREATED"
  | "RANKED"
  | "TIER_NOTIFIED"
  | "LINK_OPENED"
  | "ACCEPTED"
  | "DECLINED"
  | "ESCALATED"
  | "FILLED"
  | "EXPIRED"
  | "CANCELLED";

export type SosActorType = "SYSTEM" | "USER" | "EMPLOYEE";

interface EmitParams {
  sosRequestId: string;
  type: SosEventType;
  actorType?: SosActorType;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Optional Prisma transaction client. Falls back to default prisma. */
  tx?: Prisma.TransactionClient;
}

/**
 * Append a single immutable row to the SOS audit ledger.
 * Never throws — event emission must not break the user-facing flow.
 */
export async function emitSosEvent(params: EmitParams): Promise<void> {
  const {
    sosRequestId,
    type,
    actorType = "SYSTEM",
    actorId = null,
    actorName = null,
    metadata,
    tx,
  } = params;

  const client = tx ?? prisma;

  try {
    await client.sosEvent.create({
      data: {
        sosRequestId,
        type,
        actorType,
        actorId,
        actorName,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  } catch {
    // Audit is best-effort — never block the main flow on a ledger write
  }
}
