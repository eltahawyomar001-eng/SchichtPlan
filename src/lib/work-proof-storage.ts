import { StorageClient } from "@supabase/storage-js";
import { log } from "@/lib/logger";

/**
 * Storage for photographic proof of work.
 *
 * Deliberately a SEPARATE, PRIVATE bucket rather than reusing
 * `ticket-attachments`, which is public: anyone holding the object path can
 * read a public bucket forever. These photos show customers' sites, gritted
 * paths, building interiors and sometimes people, and they are kept as
 * evidence for years. A permanent unauthenticated URL is the wrong default for
 * that, so reads go through short-lived signed URLs instead.
 */

export const WORK_PROOF_BUCKET = "work-proof";

/** Only formats a phone camera actually produces. No SVG: it executes script. */
export const ALLOWED_PHOTO_MIME: ReadonlyArray<string> = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

/** A modern phone photo is 2–6 MB; 15 leaves room without inviting video. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** How long a read link stays valid. Long enough to load a page, not to share. */
export const SIGNED_READ_TTL_SECONDS = 60 * 10;

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
  // service_role bypasses RLS — correct for trusted server-side signing, and
  // never sent to a device.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_STORAGE_UNCONFIGURED");
  return new StorageClient(`${url}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

let bucketReady = false;

/**
 * Create the bucket on first use.
 *
 * Provisioning it from code keeps a fresh environment (a preview deploy, a new
 * Supabase project) working without a manual console step that someone will
 * forget. Idempotent: an "already exists" answer is success.
 */
async function ensureBucket(storage: StorageClient): Promise<void> {
  if (bucketReady) return;
  const { error } = await storage.createBucket(WORK_PROOF_BUCKET, {
    public: false,
    allowedMimeTypes: [...ALLOWED_PHOTO_MIME],
    fileSizeLimit: MAX_PHOTO_BYTES,
  });
  if (error && !/already exists/i.test(error.message)) {
    log.error("[work-proof] createBucket failed", { message: error.message });
    throw new Error(`WORK_PROOF_BUCKET_ERROR: ${error.message}`);
  }
  bucketReady = true;
}

/** Workspace-scoped, collision-resistant object key. */
function buildPath(workspaceId: string, employeeId: string, ext: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${workspaceId}/${employeeId}/${Date.now()}-${rand}.${ext}`;
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export interface SignedPhotoUpload {
  path: string;
  token: string;
  signedUrl: string;
}

/**
 * Mint a one-shot upload URL so the device PUTs its bytes straight to storage.
 *
 * The bytes must not travel through the route handler: Vercel caps a
 * serverless request body at roughly 4.5 MB, and a photo from a modern phone
 * routinely exceeds that. Routing uploads through the API would fail on the
 * exact devices this feature exists for.
 */
export async function createPhotoUploadUrl(
  workspaceId: string,
  employeeId: string,
  fileType: string,
): Promise<SignedPhotoUpload> {
  const storage = getStorageClient();
  await ensureBucket(storage);

  const path = buildPath(workspaceId, employeeId, extensionFor(fileType));
  const { data, error } = await storage
    .from(WORK_PROOF_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    log.error("[work-proof] createSignedUploadUrl failed", {
      message: error?.message,
    });
    throw new Error(`WORK_PROOF_SIGN_ERROR: ${error?.message ?? "unknown"}`);
  }
  return { path, token: data.token, signedUrl: data.signedUrl };
}

/** Short-lived read URL for one stored photo. Null if it cannot be signed. */
export async function createPhotoReadUrl(
  storagePath: string,
): Promise<string | null> {
  try {
    const storage = getStorageClient();
    const { data, error } = await storage
      .from(WORK_PROOF_BUCKET)
      .createSignedUrl(storagePath, SIGNED_READ_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Size and type as STORAGE reports them, not as the client claimed.
 *
 * The upload happens out of band, so the only trustworthy description of what
 * actually landed comes from asking storage. A client is free to claim a
 * 1 KB JPEG and upload something else entirely.
 */
export async function statPhoto(
  storagePath: string,
): Promise<{ size: number; mimetype: string } | null> {
  try {
    const storage = getStorageClient();
    const slash = storagePath.lastIndexOf("/");
    const dir = storagePath.slice(0, slash);
    const name = storagePath.slice(slash + 1);
    const { data, error } = await storage
      .from(WORK_PROOF_BUCKET)
      .list(dir, { search: name, limit: 1 });
    if (error || !data?.length) return null;
    const meta = data[0].metadata as
      | { size?: number; mimetype?: string }
      | undefined;
    if (!meta?.size) return null;
    return { size: meta.size, mimetype: meta.mimetype ?? "image/jpeg" };
  } catch {
    return null;
  }
}

/** Remove an orphaned object (upload succeeded, record never created). */
export async function deletePhotoObject(storagePath: string): Promise<void> {
  try {
    const storage = getStorageClient();
    await storage.from(WORK_PROOF_BUCKET).remove([storagePath]);
  } catch {
    /* best effort — a stray object is not worth failing a request over */
  }
}
