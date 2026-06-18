/**
 * Client-side ticket attachment uploader.
 *
 * Uploads files straight from the browser to Supabase Storage using signed
 * upload URLs minted by /api/tickets/attachments/sign. This bypasses Vercel's
 * ~4.5 MB Serverless request-body limit, which otherwise silently kills any
 * ticket submission carrying larger attachments (the bytes never reach the
 * route handler). Only lightweight metadata is then sent to the ticket API.
 */

"use client";

import { StorageClient } from "@supabase/storage-js";
import { TICKET_BUCKET } from "@/lib/ticket-file-validation";

export interface UploadedAttachment {
  path: string;
  fileName: string;
  fileType: string;
}

interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

let _client: StorageClient | null = null;
function browserStorage(): StorageClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Supabase URL ist nicht konfiguriert.");
  _client = new StorageClient(`${url}/storage/v1`, {
    apikey: anon ?? "",
    Authorization: `Bearer ${anon ?? ""}`,
  });
  return _client;
}

/** Request signed upload URLs from a signing endpoint. */
async function requestSignedUploads(
  endpoint: string,
  body: Record<string, unknown>,
  files: File[],
): Promise<SignedUpload[]> {
  const signRes = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      files: files.map((f) => ({
        fileName: f.name,
        fileType: f.type,
        fileSize: f.size,
      })),
    }),
  });
  if (!signRes.ok) {
    const data = await signRes.json().catch(() => null);
    throw new Error(
      data?.message ?? data?.error ?? "Upload konnte nicht vorbereitet werden.",
    );
  }
  const { uploads } = (await signRes.json()) as { uploads: SignedUpload[] };
  return uploads;
}

/** PUT each file straight to storage via its signed URL. */
async function putToSignedUrls(
  files: File[],
  uploads: SignedUpload[],
): Promise<UploadedAttachment[]> {
  const storage = browserStorage();
  const attached: UploadedAttachment[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const u = uploads[i];
    const { error } = await storage
      .from(TICKET_BUCKET)
      .uploadToSignedUrl(u.path, u.token, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (error) {
      throw new Error(
        `${file.name}: ${error.message || "Datei-Upload fehlgeschlagen."}`,
      );
    }
    attached.push({ path: u.path, fileName: file.name, fileType: file.type });
  }
  return attached;
}

/**
 * Upload the given files to storage and return the metadata to attach to a
 * ticket. Throws with a user-facing (German) message on failure.
 *
 * @param files     Files selected by the user.
 * @param ticketId  Optional — pass when attaching to an existing ticket.
 */
export async function uploadTicketAttachments(
  files: File[],
  ticketId?: string,
): Promise<UploadedAttachment[]> {
  if (files.length === 0) return [];
  const uploads = await requestSignedUploads(
    "/api/tickets/attachments/sign",
    { ticketId },
    files,
  );
  return putToSignedUrls(files, uploads);
}

/**
 * Public (token-based) variant used by the external ticket-status page.
 * Same direct-upload flow, scoped to a ticket's external token.
 */
export async function uploadExternalTicketAttachments(
  files: File[],
  token: string,
): Promise<UploadedAttachment[]> {
  if (files.length === 0) return [];
  const uploads = await requestSignedUploads(
    `/api/tickets/external/${encodeURIComponent(token)}/attachments/sign`,
    {},
    files,
  );
  return putToSignedUrls(files, uploads);
}
