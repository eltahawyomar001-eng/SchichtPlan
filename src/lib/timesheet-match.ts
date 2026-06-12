/* ─────────────────────────────────────────────────────────────────
   Timesheet identity matching
   ─────────────────────────────────────────────────────────────────
   Resolves an extracted Stundenzettel identity (name + optional
   Personal-Nr.) to a workspace Employee. Most employees do NOT have a
   personnel number, so the realistic path is name matching — which is
   brittle against OCR errors and spelling drift. We therefore return a
   confident match when we can, a fuzzy SUGGESTION when we can't, and
   leave the final assignment to the manager on the Review screen.
   ───────────────────────────────────────────────────────────────── */

export interface MatchableEmployee {
  id: string;
  firstName: string;
  lastName: string;
  datevPersonnelNumber: string | null;
}

export interface IdentityInput {
  name: string | null;
  personnelNumber: string | null;
}

export type MatchKind = "matched" | "suggested" | "unmatched";

export interface MatchResult {
  /** Confident employee match (Personal-Nr. or exact name), else null. */
  employeeId: string | null;
  /** Best fuzzy guess for the manager to confirm when not confidently matched. */
  suggestedEmployeeId: string | null;
  kind: MatchKind;
  /** Similarity [0,1] of the suggestion (1 for a confident match). */
  score: number;
}

/** Below this fuzzy similarity we don't even suggest. */
export const SUGGEST_THRESHOLD = 0.6;

/** Normalize a person name for tolerant matching (case/space/diacritics). */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // punctuation/hyphens → space
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a personnel number (strip spaces/punctuation, lowercase). */
export function normalizePnr(input: string): string {
  return input.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Normalized similarity in [0,1] (1 = identical). */
export function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface EmployeeIndex {
  byName: Map<string, string>;
  byPnr: Map<string, string>;
  employees: MatchableEmployee[];
}

export function buildEmployeeIndex(
  employees: MatchableEmployee[],
): EmployeeIndex {
  const byName = new Map<string, string>();
  const byPnr = new Map<string, string>();
  for (const e of employees) {
    byName.set(normalizeName(`${e.firstName} ${e.lastName}`), e.id);
    byName.set(normalizeName(`${e.lastName} ${e.firstName}`), e.id);
    if (e.datevPersonnelNumber) {
      byPnr.set(normalizePnr(e.datevPersonnelNumber), e.id);
    }
  }
  return { byName, byPnr, employees };
}

/**
 * Resolve an identity:
 *   1. Personal-Nr. exact  → confident match
 *   2. Name exact (normalized, either ordering) → confident match
 *   3. Best fuzzy name ≥ SUGGEST_THRESHOLD → suggestion (manager confirms)
 *   4. otherwise → unmatched
 */
export function matchIdentity(
  identity: IdentityInput,
  index: EmployeeIndex,
): MatchResult {
  const name = identity.name?.trim() || null;
  const pnr = identity.personnelNumber?.trim() || null;

  if (pnr) {
    const id = index.byPnr.get(normalizePnr(pnr));
    if (id)
      return {
        employeeId: id,
        suggestedEmployeeId: null,
        kind: "matched",
        score: 1,
      };
  }

  if (name) {
    const exact = index.byName.get(normalizeName(name));
    if (exact) {
      return {
        employeeId: exact,
        suggestedEmployeeId: null,
        kind: "matched",
        score: 1,
      };
    }
    // Fuzzy: best similarity against "First Last".
    let best: { id: string; score: number } | null = null;
    for (const e of index.employees) {
      const score = similarity(name, `${e.firstName} ${e.lastName}`);
      if (!best || score > best.score) best = { id: e.id, score };
    }
    if (best && best.score >= SUGGEST_THRESHOLD) {
      return {
        employeeId: null,
        suggestedEmployeeId: best.id,
        kind: "suggested",
        score: best.score,
      };
    }
  }

  return {
    employeeId: null,
    suggestedEmployeeId: null,
    kind: "unmatched",
    score: 0,
  };
}
