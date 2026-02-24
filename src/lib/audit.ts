import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "ARCHIVE"
  | "LOGIN";

interface AuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  workspaceId: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit log creation.
 * Never blocks the request — errors are logged but silenced.
 */
export function createAuditLog(params: AuditLogParams): void {
  const {
    action,
    entityType,
    entityId,
    userId,
    userEmail,
    workspaceId,
    changes,
    metadata,
  } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).auditLog
    .create({
      data: {
        action,
        entityType,
        entityId: entityId ?? null,
        userId: userId ?? null,
        userEmail: userEmail ?? null,
        changes: changes ? JSON.stringify(changes) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        workspaceId,
      },
    })
    .catch((err: unknown) => {
      log.error("Failed to write audit log:", { error: err });
    });
}
