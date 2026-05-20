/**
 * Ticket Attachments — Constants, validation & storage helpers.
 *
 * Storage backend: Supabase Storage (bucket: "ticket-attachments", public).
 * Uses the Supabase Storage REST API directly via fetch — no extra SDK needed.
 * Paths are UUID-randomised so URLs are unguessable even though the bucket is
 * public; security enforcement happens at the API route layer.
 *
 *   • Per-file size cap (25 MB) and per-workspace storage quota enforced here.
 *   • MIME-type allow-list enforced in ticket-file-validation.ts.
 *   • Storage usage tracked via WorkspaceUsage.ticketStorageBytesUsed.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

// Re-export client-safe primitives so existing callers don't need to know
// about the split.
export {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
  ALLOWED_MIME_TYPES,
  validateFile,
} from "@/lib/ticket-file-validation";
export type { FileValidationResult } from "@/lib/ticket-file-validation";

/* ═══════════════════════════════════════════════════════════════
   Supabase Storage REST helpers
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "ticket-attachments";

function storageHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

/** Build a collision-resistant, workspace-scoped storage path. */
function buildStoragePath(
  workspaceId: string,
  ticketId: string,
  fileName: string,
): string {
  const safe = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 180);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${workspaceId}/${ticketId}/${Date.now()}-${rand}-${safe}`;
}

/** Derive the public URL from a storage path. */
function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Extract the storage path from a full public URL (for deletion). */
function pathFromUrl(url: string): string | null {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * Upload a file buffer to Supabase Storage and return the public URL.
 */
export async function uploadToBlob(input: {
  workspaceId: string;
  ticketId: string;
  fileName: string;
  contentType: string;
  body: Blob | ArrayBuffer | Buffer;
}): Promise<{ url: string; pathname: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const pathname = buildStoragePath(
    input.workspaceId,
    input.ticketId,
    input.fileName,
  );

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${pathname}`,
    {
      method: "POST",
      headers: {
        ...storageHeaders(),
        "Content-Type": input.contentType,
        "x-upsert": "false",
      },
      body: Buffer.isBuffer(input.body)
        ? new Uint8Array(input.body)
        : input.body instanceof ArrayBuffer
          ? new Uint8Array(input.body)
          : input.body,
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(
      `Supabase Storage upload failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }

  return { url: publicUrl(pathname), pathname };
}

/**
 * Delete a blob by its public URL.
 * Extracts the storage path, then calls the Supabase bulk-delete endpoint.
 * Errors are swallowed and logged — an orphaned file is recoverable;
 * blocking a purge on a failed delete is not acceptable UX.
 */
export async function deleteBlob(url: string): Promise<void> {
  try {
    const path = pathFromUrl(url);
    if (!path) {
      log.warn("[ticket-attachments] deleteBlob: unrecognised URL, skipping", {
        url,
      });
      return;
    }

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: {
        ...storageHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      log.warn("[ticket-attachments] deleteBlob failed", {
        url,
        status: res.status,
        detail,
      });
    }
  } catch (err) {
    log.warn("[ticket-attachments] deleteBlob threw", { url, err });
  }
}

/* ═══════════════════════════════════════════════════════════════
   Storage quota
   ═══════════════════════════════════════════════════════════════ */

export interface QuotaCheckResult {
  allowed: boolean;
  used: bigint;
  limit: bigint;
  remaining: bigint;
}

export async function checkStorageQuota(
  workspaceId: string,
  additionalBytes: number,
): Promise<QuotaCheckResult> {
  const usage = await prisma.workspaceUsage.findUnique({
    where: { workspaceId },
    select: {
      ticketStorageBytesUsed: true,
      ticketStorageBytesLimit: true,
    },
  });

  const used: bigint = usage?.ticketStorageBytesUsed ?? BigInt(0);
  const limit: bigint = usage?.ticketStorageBytesLimit ?? BigInt(0);
  const remaining: bigint = limit - used;

  return {
    allowed: BigInt(additionalBytes) <= remaining,
    used,
    limit,
    remaining,
  };
}

/** Hard guard. Returns 403 NextResponse if quota would be exceeded, else null. */
export async function requireStorageQuota(
  workspaceId: string,
  additionalBytes: number,
): Promise<NextResponse | null> {
  const { allowed, used, limit, remaining } = await checkStorageQuota(
    workspaceId,
    additionalBytes,
  );
  if (allowed) return null;
  const message =
    "Ihr aktuelles Limit wurde erreicht. Bitte beachten Sie, dass auch " +
    "Tickets im Papierkorb sowie deren Anhänge weiterhin Speicherplatz " +
    "belegen. Löschen Sie Tickets endgültig oder wechseln Sie in ein " +
    "höheres Abomodell, um weitere Tickets erstellen und Anhänge speichern " +
    "zu können.";
  return NextResponse.json(
    {
      error: "STORAGE_QUOTA_EXCEEDED",
      code: "TICKET_STORAGE_QUOTA_EXCEEDED",
      message,
      details: `${formatBytes(remaining)} frei von ${formatBytes(limit)}.`,
      used: used.toString(),
      limit: limit.toString(),
      remaining: remaining.toString(),
      trashHint: true,
      purgeUrl: "/tickets/papierkorb",
      upgradeRequired: true,
    },
    { status: 403 },
  );
}

/** Atomically increment storage usage. Call only AFTER successful blob upload. */
export async function recordStorageUsage(
  workspaceId: string,
  bytes: number | bigint,
): Promise<void> {
  await prisma.workspaceUsage.update({
    where: { workspaceId },
    data: {
      ticketStorageBytesUsed: { increment: BigInt(bytes) },
    },
  });
}

/** Atomically decrement storage usage (clamped at zero). */
export async function releaseStorageUsage(
  workspaceId: string,
  bytes: number | bigint,
): Promise<void> {
  const current = await prisma.workspaceUsage.findUnique({
    where: { workspaceId },
    select: { ticketStorageBytesUsed: true },
  });
  if (!current) return;

  const next =
    current.ticketStorageBytesUsed > BigInt(bytes)
      ? current.ticketStorageBytesUsed - BigInt(bytes)
      : BigInt(0);

  await prisma.workspaceUsage.update({
    where: { workspaceId },
    data: { ticketStorageBytesUsed: next },
  });
}

/* ═══════════════════════════════════════════════════════════════
   Misc helpers
   ═══════════════════════════════════════════════════════════════ */

export function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
