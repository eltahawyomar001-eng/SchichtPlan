/**
 * Pure file-validation primitives for ticket attachments.
 *
 * Lives in its own module so the constants and `validateFile` can be imported
 * from client components without dragging the Postgres/Prisma + Vercel Blob
 * deps along for the ride. The server-side `ticket-attachments.ts` re-exports
 * these so existing callers keep working.
 */

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
export const BLOCKED_EXTENSIONS = new Set([
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

export interface FileValidationResult {
  ok: boolean;
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
