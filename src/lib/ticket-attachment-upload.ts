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

export interface UploadedAttachment {
  path: string;
  fileName: string;
  fileType: string;
}

interface SignedUpload {
  path: string;
  token: string;
  /** Absolute signed upload URL (already carries the upload token). */
  signedUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
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

/**
 * PUT each file straight to storage via its absolute signed URL. Uses plain
 * fetch (no Supabase client) so the browser needs no Supabase env vars — the
 * signed URL minted server-side already carries the upload token.
 */
async function putToSignedUrls(
  files: File[],
  uploads: SignedUpload[],
): Promise<UploadedAttachment[]> {
  const attached: UploadedAttachment[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const u = uploads[i];
    // Mirror @supabase/storage-js' browser upload contract exactly: multipart
    // FormData with the file under the empty key, no explicit content-type so
    // the browser sets the multipart boundary. The signed URL carries the token.
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    let res: Response;
    try {
      res = await fetch(u.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body: form,
      });
    } catch {
      throw new Error(`${file.name}: Datei-Upload fehlgeschlagen.`);
    }
    if (!res.ok) {
      throw new Error(
        `${file.name}: Datei-Upload fehlgeschlagen (${res.status}).`,
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
