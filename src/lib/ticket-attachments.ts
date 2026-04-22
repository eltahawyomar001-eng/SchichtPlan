/**
 * Ticket Attachments — Constants, validation & storage helpers.
 *
 * Industry-standard ticketing attachment behaviour:
 *   • Attachments belong to a Ticket (or optionally to a specific TicketComment).
 *   • Stored in Vercel Blob under "ticket-attachments/{workspaceId}/{ticketId}/...".
 *   • Per-file size cap (25 MB) and per-workspace storage quota
 *     (WorkspaceUsage.ticketStorageBytesLimit, set by the ticketing add-on tier).
 *   • MIME-type allow-list — common office files, images, PDF, archives, plain text.
 *   • Executables and scripts are rejected outright.
 *   • Internal users (authenticated) and external token-based users can both upload.
 *   • Storage usage tracked via WorkspaceUsage.ticketStorageBytesUsed (atomic increments).
 */

import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   Limits & allow-lists
   ═══════════════════════════════════════════════════════════════ */

/** Max bytes for a single file (25 MB). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Max attachments per ticket (industry standard cap). */
export const MAX_ATTACHMENTS_PER_TICKET = 20;

/** MIME types that may be uploaded. Add cautiously. */
export const ALLOWED_MIME_TYPES: ReadonlyArray<string> = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
  // Plain text / data
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/gzip",
];

/** File extensions that are always rejected, regardless of declared MIME. */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "vbs",
  "vbe",
  "js",
  "jse",
  "wsf",
  "wsh",
  "ps1",
  "psm1",
  "sh",
  "bash",
  "zsh",
  "app",
  "dmg",
  "pkg",
  "jar",
  "apk",
  "ipa",
  "dll",
  "so",
  "dylib",
]);

/* ═══════════════════════════════════════════════════════════════
   Validation
   ═══════════════════════════════════════════════════════════════ */

export interface FileValidationResult {
  ok: boolean;
  /** Error code for i18n / API responses. */
  code?:
    | "FILE_TOO_LARGE"
    | "MIME_NOT_ALLOWED"
    | "EXTENSION_BLOCKED"
    | "EMPTY_FILE"
    | "FILENAME_REQUIRED";
  message?: string;
}

export function validateFile(file: {
  name: string;
  type: string;
  size: number;
}): FileValidationResult {
  if (!file.name || file.name.trim().length === 0) {
    return { ok: false, code: "FILENAME_REQUIRED", message: "Dateiname fehlt" };
  }
  if (file.size <= 0) {
    return { ok: false, code: "EMPTY_FILE", message: "Datei ist leer" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `Datei ist zu groß. Maximal ${(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(0)} MB erlaubt.`,
    };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "EXTENSION_BLOCKED",
      message: `Dateityp .${ext} ist aus Sicherheitsgründen nicht erlaubt.`,
    };
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return {
      ok: false,
      code: "MIME_NOT_ALLOWED",
      message: `Dateityp "${mime || "unbekannt"}" ist nicht erlaubt.`,
    };
  }
  return { ok: true };
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

/**
 * Check whether the workspace has enough remaining storage for the requested
 * number of additional bytes. Returns a structured result; callers decide on
 * the user-facing response.
 */
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

/**
 * Hard guard. Returns 403 NextResponse if quota would be exceeded, else null.
 */
export async function requireStorageQuota(
  workspaceId: string,
  additionalBytes: number,
): Promise<NextResponse | null> {
  const { allowed, used, limit, remaining } = await checkStorageQuota(
    workspaceId,
    additionalBytes,
  );
  if (allowed) return null;
  return NextResponse.json(
    {
      error: "STORAGE_QUOTA_EXCEEDED",
      code: "TICKET_STORAGE_QUOTA_EXCEEDED",
      message: `Speicherplatz für Ticket-Anhänge ist erschöpft. ${formatBytes(remaining)} frei von ${formatBytes(limit)}.`,
      used: used.toString(),
      limit: limit.toString(),
      remaining: remaining.toString(),
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
   Vercel Blob upload / delete
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build a workspace-scoped blob path.
 * Pattern: ticket-attachments/{workspaceId}/{ticketId}/{timestamp}-{safeName}
 */
function buildBlobPath(
  workspaceId: string,
  ticketId: string,
  fileName: string,
): string {
  const safe = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
  return `ticket-attachments/${workspaceId}/${ticketId}/${Date.now()}-${safe}`;
}

/**
 * Upload a file buffer to Vercel Blob and return the public URL.
 * Uses random suffix to avoid collisions; access mode is "public"
 * because URLs are unguessable and we proxy/control listing via the API.
 */
export async function uploadToBlob(input: {
  workspaceId: string;
  ticketId: string;
  fileName: string;
  contentType: string;
  body: Blob | ArrayBuffer | Buffer;
}): Promise<{ url: string; pathname: string }> {
  const pathname = buildBlobPath(
    input.workspaceId,
    input.ticketId,
    input.fileName,
  );
  const blob = await put(pathname, input.body, {
    access: "public",
    contentType: input.contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url, pathname: blob.pathname };
}

/** Delete a blob by its public URL. Errors are swallowed and logged. */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (err) {
    log.warn("[ticket-attachments] failed to delete blob", { url, err });
  }
}

/* ═══════════════════════════════════════════════════════════════
   Misc helpers
   ═══════════════════════════════════════════════════════════════ */

/** Format a bigint or number byte count as a human-readable string. */
export function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
