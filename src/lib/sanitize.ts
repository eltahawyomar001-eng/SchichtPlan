/* ═══════════════════════════════════════════════════════════════
   Input sanitization — strips dangerous HTML/script content
   ═══════════════════════════════════════════════════════════════
   Lightweight server-side sanitizer for user-generated text fields.
   Removes script tags, event handlers, and other XSS vectors
   without requiring a heavy DOM dependency like DOMPurify.

   Usage:
     import { sanitize, sanitizeObject } from "@/lib/sanitize";

     const clean = sanitize(userInput);
     const cleanBody = sanitizeObject(body, ["name", "notes"]);
   ═══════════════════════════════════════════════════════════════ */

/** Patterns that indicate XSS attack vectors */
const DANGEROUS_PATTERNS = [
  // Script tags (including variations)
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // Event handlers (onload, onclick, onerror, etc.)
  /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
  // JavaScript protocol in URLs
  /javascript\s*:/gi,
  // Data URIs with text/html or scripts
  /data\s*:\s*text\/html/gi,
  // VBScript protocol
  /vbscript\s*:/gi,
  // Expression() in CSS (IE-specific)
  /expression\s*\(/gi,
  // <iframe>, <object>, <embed>, <applet> tags
  /<\s*\/?\s*(iframe|object|embed|applet|form|input|button)\b[^>]*>/gi,
  // <link> with stylesheets (can load external resources)
  /<\s*link\b[^>]*>/gi,
  // <style> tags
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  // <base> tag (can redirect all relative URLs)
  /<\s*base\b[^>]*>/gi,
  // HTML comments (can hide content in some parsers)
  /<!--[\s\S]*?-->/g,
  // Null bytes
  /\0/g,
];

/**
 * Sanitize a single string value.
 * Strips dangerous HTML/script content while preserving safe text.
 * Returns the cleaned string, or the original value if not a string.
 */
export function sanitize(input: string): string {
  let result = input;

  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, "");
  }

  // Trim excess whitespace that might have been introduced
  return result.trim();
}

/**
 * Sanitize specific fields of an object.
 * Only processes string values for the specified keys.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): T {
  const result = { ...obj };

  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[field as string] = sanitize(value);
    }
  }

  return result;
}
