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
  /** GPS at time of event */
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
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
  ipAddress: string | null;
  userAgent: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Extracts IP address and user-agent from an incoming Request.
 * Works behind Vercel / Cloudflare / nginx proxies.
 */
export function extractFingerprint(req: Request): RequestFingerprint {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : (realIp ?? null);

  const userAgent = req.headers.get("user-agent") ?? null;

  return { ipAddress, userAgent };
}

/**
 * Computes a SHA-256 tamper-evident checksum for a visit audit entry.
 *
 * Input:  eventType|visitId|serverTimestamp|gpsLat|gpsLng|deviceId
 * Output: hex digest
 */
function computeChecksum(
  eventType: string,
  visitId: string,
  serverTimestamp: Date,
  gpsLat?: number | null,
  gpsLng?: number | null,
  deviceId?: string | null,
): string {
  const parts = [
    eventType,
    visitId,
    serverTimestamp.toISOString(),
    gpsLat?.toString() ?? "",
    gpsLng?.toString() ?? "",
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
 *   gpsLat: lat,
 *   gpsLng: lng,
 *   deviceId: body.deviceId,
 *   clientTimestamp: body.clientTimestamp ? new Date(body.clientTimestamp) : null,
 *   metadata: { withinFence: true },
 * });
 * ```
 */
export function createVisitAuditEntry(
  req: Request,
  params: VisitAuditParams,
): void {
  const serverTimestamp = new Date();
  const { ipAddress, userAgent } = extractFingerprint(req);

  const checksum = computeChecksum(
    params.eventType,
    params.visitId,
    serverTimestamp,
    params.gpsLat,
    params.gpsLng,
    params.deviceId,
  );

  prisma.serviceVisitAuditLog
    .create({
      data: {
        eventType: params.eventType,
        serverTimestamp,
        clientTimestamp: params.clientTimestamp ?? null,
        gpsLat: params.gpsLat ?? null,
        gpsLng: params.gpsLng ?? null,
        gpsAccuracy: params.gpsAccuracy ?? null,
        deviceId: params.deviceId ?? null,
        ipAddress,
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
  gpsLat: number | null;
  gpsLng: number | null;
  deviceId: string | null;
  checksum: string;
}): boolean {
  const expected = computeChecksum(
    record.eventType,
    record.visitId,
    record.serverTimestamp,
    record.gpsLat,
    record.gpsLng,
    record.deviceId,
  );
  return expected === record.checksum;
}
