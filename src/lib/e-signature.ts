/**
 * E-Signature (SES) — Simple Electronic Signature per eIDAS Regulation Art. 25
 *
 * Creates tamper-evident audit records for approval/rejection actions.
 * Records: who signed, when, what action, from which IP, with which consent statement.
 * A SHA-256 hash ensures integrity of the signature record.
 *
 * Legal basis:
 * - eIDAS Art. 25§1: An electronic signature shall not be denied legal effect
 *   and admissibility as evidence solely on the grounds that it is in electronic form.
 * - German VDG (Vertrauensdienstegesetz) implements eIDAS in national law.
 * - SES is sufficient for internal HR operational decisions (absence approvals,
 *   time entry confirmations, shift swap approvals). Employment contracts and
 *   terminations require Schriftform (§623 BGB) = handwritten or QES.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────

export interface ESignatureInput {
  /** The action being signed, e.g. "absence.approve", "time-entry.confirm" */
  action: string;
  /** The Prisma model name, e.g. "AbsenceRequest", "TimeEntry" */
  entityType: string;
  /** The ID of the entity being acted upon */
  entityId: string;
  /** The user performing the signature */
  signer: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  /** Workspace ID for tenant scoping */
  workspaceId: string;
  /** IP address from the request (optional but recommended) */
  ipAddress?: string;
  /** User-Agent header from the request (optional) */
  userAgent?: string;
}

export interface ESignatureRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  signedBy: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  signatureHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  statement: string;
  signedAt: Date;
  workspaceId: string;
}

// ─── Consent Statements ─────────────────────────────────────────

const CONSENT_STATEMENTS: Record<string, Record<string, string>> = {
  "absence.approve": {
    de: "Ich bestätige hiermit die Genehmigung dieses Abwesenheitsantrags als autorisierte Person.",
    en: "I hereby confirm the approval of this absence request as an authorized person.",
  },
  "absence.reject": {
    de: "Ich bestätige hiermit die Ablehnung dieses Abwesenheitsantrags als autorisierte Person.",
    en: "I hereby confirm the rejection of this absence request as an authorized person.",
  },
  "time-entry.confirm": {
    de: "Ich bestätige hiermit die Freigabe dieses Zeiteintrags als autorisierte Person.",
    en: "I hereby confirm the approval of this time entry as an authorized person.",
  },
  "time-entry.reject": {
    de: "Ich bestätige hiermit die Zurückweisung dieses Zeiteintrags als autorisierte Person.",
    en: "I hereby confirm the rejection of this time entry as an authorized person.",
  },
  "shift-swap.approve": {
    de: "Ich bestätige hiermit die Genehmigung dieses Schichttauschs als autorisierte Person.",
    en: "I hereby confirm the approval of this shift swap as an authorized person.",
  },
  "shift-swap.reject": {
    de: "Ich bestätige hiermit die Ablehnung dieses Schichttauschs als autorisierte Person.",
    en: "I hereby confirm the rejection of this shift swap as an authorized person.",
  },
  "shift-change.approve": {
    de: "Ich bestätige hiermit die Genehmigung dieser Schichtänderung als autorisierte Person.",
    en: "I hereby confirm the approval of this shift change as an authorized person.",
  },
  "shift-change.reject": {
    de: "Ich bestätige hiermit die Ablehnung dieser Schichtänderung als autorisierte Person.",
    en: "I hereby confirm the rejection of this shift change as an authorized person.",
  },
  "month-close.lock": {
    de: "Ich bestätige hiermit den Monatsabschluss und die Sperrung des Abrechnungszeitraums als autorisierte Person.",
    en: "I hereby confirm the monthly closing and locking of the billing period as an authorized person.",
  },
};

function getConsentStatement(action: string, locale: string = "de"): string {
  const statements = CONSENT_STATEMENTS[action];
  if (!statements) {
    return locale === "de"
      ? `Ich bestätige hiermit diese Aktion (${action}) als autorisierte Person.`
      : `I hereby confirm this action (${action}) as an authorized person.`;
  }
  return statements[locale] || statements.de;
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Generate a SHA-256 signature hash for integrity verification.
 * The hash combines: action, entityType, entityId, signerId, signerEmail, timestamp.
 */
function generateSignatureHash(
  action: string,
  entityType: string,
  entityId: string,
  signerId: string,
  signerEmail: string,
  timestamp: Date,
): string {
  const payload = [
    action,
    entityType,
    entityId,
    signerId,
    signerEmail,
    timestamp.toISOString(),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Create an e-signature record for an approval/rejection action.
 *
 * This is the main function to call from API routes when a user
 * approves, rejects, or confirms something.
 *
 * @returns The created ESignature record
 */
export async function createESignature(
  input: ESignatureInput,
  locale: string = "de",
): Promise<ESignatureRecord> {
  const signedAt = new Date();
  const statement = getConsentStatement(input.action, locale);
  const signatureHash = generateSignatureHash(
    input.action,
    input.entityType,
    input.entityId,
    input.signer.id,
    input.signer.email,
    signedAt,
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (prisma as any).eSignature.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        signedBy: input.signer.id,
        signerName: input.signer.name,
        signerEmail: input.signer.email,
        signerRole: input.signer.role,
        signatureHash,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        statement,
        signedAt,
        workspaceId: input.workspaceId,
      },
    });

    log.info("E-signature created", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      signedBy: input.signer.email,
      hash: signatureHash.substring(0, 12) + "...",
    });

    return record;
  } catch (error) {
    log.error("Failed to create e-signature", {
      action: input.action,
      entityId: input.entityId,
      error,
    });
    throw error;
  }
}

/**
 * Retrieve all e-signatures for a specific entity.
 * Useful for displaying the signature audit trail on detail pages.
 */
export async function getSignaturesForEntity(
  entityType: string,
  entityId: string,
  workspaceId: string,
): Promise<ESignatureRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any).eSignature.findMany({
    where: { entityType, entityId, workspaceId },
    orderBy: { signedAt: "desc" },
  });
}

/**
 * Verify the integrity of a signature record by recomputing the hash.
 */
export function verifySignatureIntegrity(record: ESignatureRecord): boolean {
  const recomputedHash = generateSignatureHash(
    record.action,
    record.entityType,
    record.entityId,
    record.signedBy,
    record.signerEmail,
    record.signedAt,
  );
  return recomputedHash === record.signatureHash;
}

/**
 * Helper to extract IP address from a Next.js request.
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return undefined;
}
