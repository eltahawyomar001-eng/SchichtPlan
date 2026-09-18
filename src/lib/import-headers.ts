/**
 * Header normalisation for spreadsheet imports (POST /api/import).
 *
 * Every column alias the importer looks up is space-free — "firstname",
 * "hourlyrate", "weeklyhours", "startzeit" — but the upload hint in the UI
 * tells people to use "first name", "hourly rate", "weekly hours". Trimming
 * and lowercasing alone left those as "first name", which matched no alias, so
 * a spreadsheet built from the on-screen instructions imported zero rows with
 * "Fehlender Name" on every one.
 *
 * Collapsing whitespace can only widen the set of headers that match: no alias
 * contains a space, so no previously-working header changes meaning.
 */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}
