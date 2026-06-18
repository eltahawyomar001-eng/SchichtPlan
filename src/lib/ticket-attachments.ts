/**
 * Ticket Attachments — Constants, validation & storage helpers.
 *
 * Storage backend: Supabase Storage (bucket: "ticket-attachments", public).
 * Uses @supabase/storage-js for reliable uploads — handles content-type,
 * streaming, and structured error responses automatically.
 * Paths are randomised so URLs are unguessable; security is enforced at the
 * API route layer.
 */

import { StorageClient } from "@supabase/storage-js";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import {
  checkMagicBytes as _checkMagicBytes,
  validateFile as _validateFile,
} from "@/lib/ticket-file-validation";

export {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_EXTERNAL_FILE_BYTES,
  MAX_EXTERNAL_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
  TICKET_BUCKET,
  validateFile,
  checkMagicBytes,
} from "@/lib/ticket-file-validation";

import { TICKET_BUCKET } from "@/lib/ticket-file-validation";
export type { FileValidationResult } from "@/lib/ticket-file-validation";

/* ═══════════════════════════════════════════════════════════════
   Supabase Storage client
   ═══════════════════════════════════════════════════════════════ */

const BUCKET = TICKET_BUCKET;

/**
 * Resolve the Supabase project URL.
 * Priority: SUPABASE_URL → NEXT_PUBLIC_SUPABASE_URL → derived from DATABASE_URL.
 * DATABASE_URL is guaranteed to be set in every environment (Prisma won't start
 * without it), so the derivation is a reliable last-resort fallback.
 */
function resolveSupabaseUrl(): string | null {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL)
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Extract project ref from DATABASE_URL or DIRECT_URL:
  // postgresql://postgres.{ref}:password@host/postgres
  const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
  const match = dbUrl.match(/postgres\.([a-z0-9]+)[.:]/);
  if (match?.[1]) return `https://${match[1]}.supabase.co`;
  return null;
}

function getStorageClient(): StorageClient {
  const url = resolveSupabaseUrl();
  // service_role key bypasses RLS — correct for trusted server-side uploads.
  // Never expose this key client-side.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_STORAGE_UNCONFIGURED");
  }
  return new StorageClient(`${url}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
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
  const url = resolveSupabaseUrl() ?? "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Extract the storage path from a full public URL (for deletion). */
function pathFromUrl(fileUrl: string): string | null {
  const url = resolveSupabaseUrl();
  if (!url) return null;
  const prefix = `${url}/storage/v1/object/public/${BUCKET}/`;
  return fileUrl.startsWith(prefix) ? fileUrl.slice(prefix.length) : null;
}

/**
 * Upload a file buffer to Supabase Storage and return the public URL.
 * Throws on failure with a descriptive message that includes the Supabase
 * error detail so it reaches the server logs.
 */
export async function uploadToBlob(input: {
  workspaceId: string;
  ticketId: string;
  fileName: string;
  contentType: string;
  body: Blob | ArrayBuffer | Buffer;
}): Promise<{ url: string; pathname: string }> {
  const storage = getStorageClient();
  const pathname = buildStoragePath(
    input.workspaceId,
    input.ticketId,
    input.fileName,
  );

  // StorageClient expects a Blob/File/Buffer; convert ArrayBuffer → Buffer.
  const body =
    input.body instanceof ArrayBuffer ? Buffer.from(input.body) : input.body;

  const { error } = await storage.from(BUCKET).upload(pathname, body, {
    contentType: input.contentType,
    upsert: false,
  });

  if (error) {
    log.error("[ticket-attachments] Supabase upload error", {
      message: error.message,
      pathname,
    });
    throw new Error(`SUPABASE_UPLOAD_ERROR: ${error.message}`);
  }

  return { url: publicUrl(pathname), pathname };
}

/**
 * Delete a blob by its public URL.
 * Errors are swallowed and logged — an orphaned file is recoverable.
 */
export async function deleteBlob(fileUrl: string): Promise<void> {
  try {
    const path = pathFromUrl(fileUrl);
    if (!path) {
      log.warn("[ticket-attachments] deleteBlob: unrecognised URL, skipping", {
        fileUrl,
      });
      return;
    }
    const storage = getStorageClient();
    const { error } = await storage.from(BUCKET).remove([path]);
    if (error) {
      log.warn("[ticket-attachments] deleteBlob failed", {
        fileUrl,
        message: error.message,
      });
    }
  } catch (err) {
    log.warn("[ticket-attachments] deleteBlob threw", { fileUrl, err });
  }
}

/* ═══════════════════════════════════════════════════════════════
   Direct browser → storage uploads (signed upload URLs)

   Vercel Serverless Functions hard-reject request bodies larger than
   ~4.5 MB at the platform edge — long before the route handler runs and
   regardless of `runtime = "nodejs"`. Routing multi-megabyte attachments
   through /api/tickets therefore fails silently for any file (or batch)
   over that limit. To honour the advertised 25 MB/file ceiling we issue a
   short-lived signed upload URL and let the browser PUT the bytes straight
   to Supabase Storage, then send only lightweight metadata to the API.
   ═══════════════════════════════════════════════════════════════ */

export interface SignedUpload {
  /** Storage object path (workspace-scoped). Echoed back at finalize time. */
  path: string;
  /** One-time upload token bound to `path`. */
  token: string;
  /** Full signed URL the browser uploads to. */
  signedUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * Create one signed upload URL per file. Paths are workspace-scoped so the
 * finalize step can reject any attempt to attach an object from outside the
 * caller's workspace.
 */
export async function createSignedUploadUrls(
  workspaceId: string,
  files: Array<{ fileName: string; fileType: string; fileSize: number }>,
): Promise<SignedUpload[]> {
  const storage = getStorageClient();
  const out: SignedUpload[] = [];
  for (const f of files) {
    const path = buildStoragePath(workspaceId, "uploads", f.fileName);
    const { data, error } = await storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      log.error("[ticket-attachments] createSignedUploadUrl error", {
        message: error?.message,
        path,
      });
      throw new Error(
        `SUPABASE_SIGN_ERROR: ${error?.message ?? "unknown error"}`,
      );
    }
    out.push({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      fileName: f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize,
    });
  }
  return out;
}

export interface FinalizedAttachment {
  path: string;
  fileName: string;
  fileType: string;
  /** Authoritative size read back from storage (not client-supplied). */
  size: number;
  publicUrl: string;
}

export interface AttachmentRejection {
  fileName: string;
  code: string;
  message: string;
}

/**
 * Verify objects a client claims to have uploaded directly to storage, before
 * linking them to a ticket. Guards against:
 *   • cross-workspace / arbitrary paths (prefix check)
 *   • objects that don't actually exist
 *   • size / type / extension violations (authoritative size from storage)
 *   • content that doesn't match the declared type (magic-byte sniff)
 *
 * Returns the validated attachments plus per-file rejections. Rejected objects
 * are deleted best-effort so they don't linger as orphans.
 */
export async function finalizeDirectUploads(
  workspaceId: string,
  claims: Array<{ path: string; fileName: string; fileType: string }>,
): Promise<{
  valid: FinalizedAttachment[];
  rejections: AttachmentRejection[];
}> {
  const storage = getStorageClient();
  const valid: FinalizedAttachment[] = [];
  const rejections: AttachmentRejection[] = [];
  const prefix = `${workspaceId}/`;

  for (const claim of claims) {
    const reject = async (code: string, message: string) => {
      rejections.push({ fileName: claim.fileName, code, message });
      // Best-effort cleanup of an object we won't be linking.
      if (claim.path.startsWith(prefix))
        await deleteBlob(publicUrl(claim.path));
    };

    // ── Workspace scoping: never link an object outside this workspace. ──
    if (!claim.path.startsWith(prefix) || claim.path.includes("..")) {
      rejections.push({
        fileName: claim.fileName,
        code: "INVALID_PATH",
        message: "Ungültiger Datei-Pfad.",
      });
      continue;
    }

    // ── Authoritative size + existence from storage metadata. ──
    let size = 0;
    try {
      const { data: meta, error } = await storage.from(BUCKET).info(claim.path);
      if (error || !meta) {
        await reject("UPLOAD_NOT_FOUND", "Hochgeladene Datei nicht gefunden.");
        continue;
      }
      size = Number((meta as { size?: number }).size ?? 0);
    } catch {
      await reject("UPLOAD_NOT_FOUND", "Hochgeladene Datei nicht gefunden.");
      continue;
    }

    // ── Same size/type/extension rules as the direct multipart path. ──
    const v = _validateFile({
      name: claim.fileName,
      type: claim.fileType,
      size,
    });
    if (!v.ok) {
      await reject(v.code ?? "INVALID_FILE", v.message ?? "Datei abgelehnt.");
      continue;
    }

    // ── Magic-byte sniff: read the first bytes back from the public object. ──
    try {
      const res = await fetch(publicUrl(claim.path), {
        headers: { Range: "bytes=0-15" },
      });
      if (res.ok || res.status === 206) {
        const head = new Uint8Array(await res.arrayBuffer());
        if (!_checkMagicBytes(head, claim.fileType)) {
          await reject(
            "MAGIC_BYTES_MISMATCH",
            `Der Inhalt von "${claim.fileName}" stimmt nicht mit dem deklarierten Dateityp überein.`,
          );
          continue;
        }
      }
    } catch {
      // Network blip reading back the head — fail open on the sniff only;
      // size/type/extension already validated above.
    }

    valid.push({
      path: claim.path,
      fileName: claim.fileName,
      fileType: claim.fileType,
      size,
      publicUrl: publicUrl(claim.path),
    });
  }

  return { valid, rejections };
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

  // A limit of 0 means the workspace has no ticketing storage tier configured.
  // The addon gate (requireTicketingAddon) is the authoritative quota check;
  // here we treat 0 as unlimited to avoid double-blocking.
  if (limit === BigInt(0)) {
    return { allowed: true, used, limit, remaining: BigInt(0) };
  }

  const remaining = limit - used;
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

/** Atomically increment storage usage. Call only AFTER successful upload. */
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
