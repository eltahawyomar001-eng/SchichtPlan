import crypto from "crypto";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────

type VisitAuditEventType =
  | "CHECK_IN"
  | "CHECK_OUT"
  | "SIGNATURE_CAPTURED"
  | "VISIT_CREATED"
  | "VISIT_CANCELLED"
  | "OFFLINE_SYNC";

interface VisitAuditParams {
  eventType: VisitAuditEventType;
  visitId: string;
  userId?: string;
  workspaceId: string;
  /** Client-side device UUID (localStorage) */
  deviceId?: string | null;
  /** Client-reported timestamp for drift detection */
  clientTimestamp?: Date | null;
  /** Base64 signature PNG (only for SIGNATURE_CAPTURED) */
  signatureData?: string | null;
  /** Arbitrary JSON metadata */
  metadata?: Record<string, unknown> | null;
  /** Was this synced from an offline queue? */
  offlineSync?: boolean;
}

interface RequestFingerprint {
  userAgent: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Extracts user-agent from an incoming Request for audit logging.
 */
export function extractFingerprint(req: Request): RequestFingerprint {
  const userAgent = req.headers.get("user-agent") ?? null;

  return { userAgent };
}

/**
 * Computes a SHA-256 tamper-evident checksum for a visit audit entry.
 *
 * Input:  eventType|visitId|serverTimestamp|deviceId
 * Output: hex digest
 */
function computeChecksum(
  eventType: string,
  visitId: string,
  serverTimestamp: Date,
  deviceId?: string | null,
): string {
  const parts = [
    eventType,
    visitId,
    serverTimestamp.toISOString(),
    deviceId ?? "",
  ].join("|");

  return crypto.createHash("sha256").update(parts).digest("hex");
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Fire-and-forget revisionssicher audit entry for a service visit event.
 *
 * - Computes SHA-256 checksum for integrity verification
 * - Extracts device fingerprint from the HTTP request
 * - Writes to ServiceVisitAuditLog without blocking the response
 *
 * @example
 * ```ts
 * createVisitAuditEntry(req, {
 *   eventType: "CHECK_IN",
 *   visitId: id,
 *   userId: user.id,
 *   workspaceId,
 *   deviceId: body.deviceId,
 *   clientTimestamp: body.clientTimestamp ? new Date(body.clientTimestamp) : null,
 *   metadata: { employeeId: visit.employeeId },
 * });
 * ```
 */
export function createVisitAuditEntry(
  req: Request,
  params: VisitAuditParams,
): void {
  const serverTimestamp = new Date();
  const { userAgent } = extractFingerprint(req);

  const checksum = computeChecksum(
    params.eventType,
    params.visitId,
    serverTimestamp,
    params.deviceId,
  );

  prisma.serviceVisitAuditLog
    .create({
      data: {
        eventType: params.eventType,
        serverTimestamp,
        clientTimestamp: params.clientTimestamp ?? null,
        deviceId: params.deviceId ?? null,
        userAgent,
        signatureData: params.signatureData ?? null,
        checksum,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        offlineSync: params.offlineSync ?? false,
        visitId: params.visitId,
        userId: params.userId ?? null,
        workspaceId: params.workspaceId,
      },
    })
    .then(() => {
      log.info("[visit-audit] Entry created", {
        eventType: params.eventType,
        visitId: params.visitId,
        checksum: checksum.slice(0, 12) + "…",
      });
    })
    .catch((err: unknown) => {
      log.error("[visit-audit] Failed to write audit entry", {
        error: err,
        eventType: params.eventType,
        visitId: params.visitId,
      });
    });
}

/**
 * Verify that an existing audit log record's checksum matches
 * the recomputed value. Returns true if the record is untampered.
 */
export function verifyAuditChecksum(record: {
  eventType: string;
  visitId: string;
  serverTimestamp: Date;
  deviceId: string | null;
  checksum: string;
}): boolean {
  const expected = computeChecksum(
    record.eventType,
    record.visitId,
    record.serverTimestamp,
    record.deviceId,
  );
  return expected === record.checksum;
}
