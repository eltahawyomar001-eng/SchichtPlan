/**
 * @vitest-environment node
 *
 * The onboarding gate redirects any non-allowlisted path to /onboarding. The
 * wizard's own fetch() calls read that redirect as success and advance the
 * step, so a missing entry silently discards the user's work rather than
 * failing loudly. This test reads the wizard source and asserts every endpoint
 * it actually calls is reachable — so adding a new fetch() without allowlisting
 * it fails here instead of in production.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isOnboardingAllowed } from "@/lib/onboarding-allowlist";

const WIZARD = join(process.cwd(), "src/app/onboarding/page.tsx");

/** Every literal /api/... path the onboarding wizard fetches. */
function wizardEndpoints(): string[] {
  const src = readFileSync(WIZARD, "utf8");
  const found = new Set<string>();
  for (const m of src.matchAll(/fetch\(\s*[`"'](\/api\/[^`"'?]*)/g)) {
    found.add(m[1]);
  }
  return [...found].sort();
}

describe("onboarding allowlist", () => {
  it("finds the wizard's fetch calls (guards against the regex silently breaking)", () => {
    expect(wizardEndpoints().length).toBeGreaterThanOrEqual(5);
  });

  it("covers every endpoint the onboarding wizard calls", () => {
    const blocked = wizardEndpoints().filter((p) => !isOnboardingAllowed(p));
    expect(blocked).toEqual([]);
  });

  it("covers the endpoints that were silently discarding user work", () => {
    // Regression: these four were missing. /api/locations meant no workspace
    // created a location during onboarding; /api/import meant no bulk employee
    // import ever landed a row.
    expect(isOnboardingAllowed("/api/locations")).toBe(true);
    expect(isOnboardingAllowed("/api/employees")).toBe(true);
    expect(isOnboardingAllowed("/api/import")).toBe(true);
    expect(isOnboardingAllowed("/api/import/status")).toBe(true);
    expect(isOnboardingAllowed("/api/public/plans")).toBe(true);
  });

  it("still blocks the rest of the app", () => {
    for (const p of [
      "/api/shifts",
      "/api/tickets",
      "/dashboard",
      "/schichtplan",
    ]) {
      expect(isOnboardingAllowed(p)).toBe(false);
    }
  });
});
