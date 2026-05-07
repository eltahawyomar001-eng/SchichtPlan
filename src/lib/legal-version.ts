/**
 * Current legal-document version. Increment when AGB or Datenschutz substantively
 * changes. Users with a stored `tosVersion` lower than this are forced to
 * re-accept on next login (blocking modal).
 *
 * Format: YYYY-MM-DD of the publication date.
 */
export const CURRENT_TOS_VERSION = "2026-05-07";

/**
 * Human-readable "Last updated" date shown on the legal pages themselves.
 * Kept identical to CURRENT_TOS_VERSION so the user-visible date matches the
 * version they're being asked to accept.
 */
export const LEGAL_LAST_UPDATED_ISO = CURRENT_TOS_VERSION;

export function formatLegalDateDe(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
