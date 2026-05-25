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
    | "FILENAME_REQUIRED"
    | "MAGIC_BYTES_MISMATCH";
  message?: string;
}

/**
 * Known magic-byte signatures mapped to the MIME types they prove.
 * We only check the leading N bytes, so signatures are compared as prefixes.
 * Sources: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
const MAGIC_SIGNATURES: Array<{ bytes: number[]; mime: string }> = [
  // Images
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    mime: "image/png",
  },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" }, // "RIFF" prefix; refined below
  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  // ZIP-based (docx, xlsx, pptx, odt, ods, zip)
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },
  { bytes: [0x50, 0x4b, 0x05, 0x06], mime: "application/zip" },
  // Legacy Office (doc, xls, ppt) — Compound Document
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    mime: "application/msword",
  },
  // 7-zip
  {
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
    mime: "application/x-7z-compressed",
  },
  // gzip
  { bytes: [0x1f, 0x8b], mime: "application/gzip" },
  // tar (ustar magic at offset 257 is complex; skip deep check for tar)
];

/**
 * MIME types whose byte-level validation is not reliably checkable from the
 * first 8 bytes (plain text, CSV, JSON, XML, SVG, Markdown, RTF, HEIC/HEIF,
 * RAR, APK). We skip the magic check and rely on the MIME+extension allow-list.
 */
const SKIP_MAGIC_CHECK = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "application/rtf",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/x-zip-compressed", // same bytes as zip; covered by zip sig
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.ms-excel", // same Compound Doc magic as .doc
  "application/vnd.ms-powerpoint", // same Compound Doc magic as .doc
  // OOXML (.docx/.xlsx/.pptx) all use the ZIP magic bytes already listed
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/** ZIP-based MIME types that share the PK magic bytes. */
const ZIP_BASED_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

/** Compound Document MIME types that share the D0CF magic bytes. */
const COMPOUND_DOC_MIMES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

/**
 * Verify that the leading bytes of a file buffer match the claimed MIME type.
 * Returns false if the mismatch is definitive (e.g. claimed JPEG but PNG bytes
 * found). Returns true when the check is inconclusive or skipped.
 *
 * @param buffer  The raw file bytes (only the first 8 are read).
 * @param mime    The browser-reported MIME type to validate against.
 */
export function checkMagicBytes(buffer: Uint8Array, mime: string): boolean {
  if (SKIP_MAGIC_CHECK.has(mime)) return true;
  if (buffer.length < 2) return true; // can't tell from too few bytes

  const head = Array.from(buffer.slice(0, 8));

  // Expand groupings: any ZIP-based type accepts ZIP magic
  const effectiveMime = ZIP_BASED_MIMES.has(mime)
    ? "application/zip"
    : COMPOUND_DOC_MIMES.has(mime)
      ? "application/msword"
      : mime;

  const sigs = MAGIC_SIGNATURES.filter((s) => s.mime === effectiveMime);
  if (sigs.length === 0) return true; // no signature on file → skip check

  // Special case: "image/webp" uses RIFF header but bytes 8-11 must be "WEBP"
  if (mime === "image/webp") {
    const isRiff =
      head[0] === 0x52 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x46;
    if (!isRiff) return false;
    if (buffer.length >= 12) {
      const webp = [buffer[8], buffer[9], buffer[10], buffer[11]];
      return (
        webp[0] === 0x57 &&
        webp[1] === 0x45 &&
        webp[2] === 0x42 &&
        webp[3] === 0x50
      );
    }
    return true;
  }

  return sigs.some((sig) =>
    sig.bytes.every((b, i) => i < head.length && head[i] === b),
  );
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
