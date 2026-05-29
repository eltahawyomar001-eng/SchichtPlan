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

export async function uploadWorkspaceLogo(
  workspaceId: string,
  contentType: string,
  body: Buffer,
): Promise<string> {
  const ext =
    contentType === "image/svg+xml"
      ? "svg"
      : contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";
  const path = `workspace-logos/${workspaceId}/logo.${ext}`;
  const storage = getStorageClient();

  // Delete any existing logo first (upsert doesn't work well across extensions)
  await deleteWorkspaceLogo(`${path.replace(`.${ext}`, ".png")}`).catch(
    () => {},
  );
  await deleteWorkspaceLogo(`${path.replace(`.${ext}`, ".jpg")}`).catch(
    () => {},
  );
  await deleteWorkspaceLogo(`${path.replace(`.${ext}`, ".webp")}`).catch(
    () => {},
  );
  await deleteWorkspaceLogo(`${path.replace(`.${ext}`, ".svg")}`).catch(
    () => {},
  );

  const { error } = await storage.from(BUCKET).upload(path, body, {
    contentType,
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
