/**
 * The planning page renders shifts, employees and locations as lists, so what
 * it stores for them must BE a list.
 *
 * It used to unwrap every response as `json.data ?? json` with no check on
 * res.ok. Any error body -- `{ error: "..." }` from a 500, a rate limit, a
 * transient failure right after deleting a shift -- was therefore stored where
 * the render expects an array, and the next render threw on .map and took the
 * whole page down to the error boundary. "Erneut versuchen" re-ran the same
 * fetch and stored the same object again, so it only recovered once the API
 * did, on its own, much later.
 *
 * This pins the unwrapping rule itself. The page's copy must stay in step with
 * it; the shape of the bug is what matters, and it is worth stating once in a
 * place that runs.
 */
import { describe, it, expect } from "vitest";

/** Mirrors `asList` in src/app/(dashboard)/schichtplan/page.tsx. */
function asList(res: { ok: boolean }, json: unknown): unknown[] | null {
  if (!res.ok) return null;
  const unwrapped =
    json && typeof json === "object" && "data" in json
      ? (json as { data: unknown }).data
      : json;
  return Array.isArray(unwrapped) ? unwrapped : null;
}

const OK = { ok: true };
const FAILED = { ok: false };

describe("planning page list unwrapping", () => {
  it("unwraps a paginated payload", () => {
    expect(asList(OK, { data: [{ id: "s1" }], pagination: {} })).toEqual([
      { id: "s1" },
    ]);
  });

  it("accepts a bare array", () => {
    expect(asList(OK, [{ id: "s1" }])).toEqual([{ id: "s1" }]);
  });

  it("rejects an error body instead of storing it as a list", () => {
    // The exact failure: this object reached setShifts and the next render
    // called .map on it.
    expect(asList(OK, { error: "Interner Fehler" })).toBeNull();
  });

  it("rejects any non-2xx response, whatever the body looks like", () => {
    // A 500 that happens to return a valid-looking array is still a failure,
    // and rendering it would show stale or partial data as if it were current.
    expect(asList(FAILED, { data: [{ id: "s1" }] })).toBeNull();
    expect(asList(FAILED, [{ id: "s1" }])).toBeNull();
  });

  it("rejects null and undefined payloads", () => {
    expect(asList(OK, null)).toBeNull();
    expect(asList(OK, undefined)).toBeNull();
  });

  it("rejects a paginated envelope whose data is not a list", () => {
    expect(asList(OK, { data: { error: "nope" } })).toBeNull();
  });

  it("allows a legitimately empty list", () => {
    // Deleting the last shift of the week is not an error, and must not be
    // treated as one.
    expect(asList(OK, { data: [] })).toEqual([]);
    expect(asList(OK, [])).toEqual([]);
  });
});
