import { createHash } from "node:crypto";
import { StorageClient } from "@supabase/storage-js";
import { log } from "@/lib/logger";

const BUCKET = "ticket-attachments";
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

function resolveSupabaseUrl(): string | null {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL)
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
  const match = dbUrl.match(/postgres\.([a-z0-9]+)[.:]/);
  if (match?.[1]) return `https://${match[1]}.supabase.co`;
  return null;
}

function getStorageClient(): StorageClient {
  const url = resolveSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_STORAGE_UNCONFIGURED");
  return new StorageClient(`${url}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

function publicUrl(path: string): string {
  const url = resolveSupabaseUrl();
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

export { MAX_LOGO_BYTES, ALLOWED_LOGO_TYPES };

function extensionFor(contentType: string): string {
  return contentType === "image/svg+xml"
    ? "svg"
    : contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
}

/**
 * A logo filename is the hash of its own bytes.
 *
 * The old scheme wrote every upload to one fixed key per workspace
 * (`workspace-logos/<id>/logo.png`), so changing the logo left the URL
 * identical. Nothing downstream could tell that the bytes behind it had
 * changed, and three separate caches went on serving the old image: the
 * Next.js data cache that holds the base64 for the PDF, the Supabase/Cloudflare
 * CDN, and the browser. A company changed its logo, saw the new one in the app,
 * and kept sending invoices with the old one.
 *
 * Content addressing removes the problem rather than racing it. Different
 * bytes produce a different URL, so no cache can hold a stale answer for a URL
 * that did not exist before; identical bytes produce the same URL, so
 * re-uploading the same file is free. This is the same trick every asset
 * pipeline uses for fingerprinted bundles, and it is what lets the file be
 * cached hard instead of re-fetched on every invoice.
 */
const LOGO_HASH_LENGTH = 32;

/** 1 year. Safe only because the URL names the exact bytes it returns. */
const IMMUTABLE_CACHE_SECONDS = "31536000";

/** Does this URL name its own content, or is it a legacy fixed path? */
export function isContentAddressedLogo(url: string): boolean {
  const file = url.split("?")[0].split("/").pop() ?? "";
  return new RegExp(
    `^[0-9a-f]{${LOGO_HASH_LENGTH}}\\.(png|jpg|webp|svg)$`,
  ).test(file);
}

export async function uploadWorkspaceLogo(
  workspaceId: string,
  contentType: string,
  body: Buffer,
): Promise<string> {
  const ext = extensionFor(contentType);
  const hash = createHash("sha256")
    .update(body)
    .digest("hex")
    .slice(0, LOGO_HASH_LENGTH);
  const path = `workspace-logos/${workspaceId}/${hash}.${ext}`;
  const storage = getStorageClient();

  /**
   * Upload before anything is removed, and never remove here.
   *
   * The previous version deleted all four possible extensions up front, so an
   * upload that then failed left the workspace with no logo at all -- it had
   * destroyed the only copy before writing the replacement. The old file is
   * now cleaned up by the caller, after the database points at the new one.
   */
  const { error } = await storage.from(BUCKET).upload(path, body, {
    contentType,
    cacheControl: IMMUTABLE_CACHE_SECONDS,
    // The same bytes land on the same path, so a re-upload is a no-op write
    // rather than a conflict.
    upsert: true,
  });

  if (error) {
    log.error("[workspace-logo] upload error", { message: error.message });
    throw new Error(`Logo upload failed: ${error.message}`);
  }

  return publicUrl(path);
}

export async function deleteWorkspaceLogo(path: string): Promise<void> {
  try {
    const storage = getStorageClient();
    const cleanPath = path.includes("/storage/v1/object/public/")
      ? path.split(`/${BUCKET}/`)[1]
      : path;
    if (cleanPath) await storage.from(BUCKET).remove([cleanPath]);
  } catch {
    // swallow — orphaned files are not critical
  }
}
