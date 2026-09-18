/**
 * Paths a workspace with `onboardingCompleted = false` may still reach.
 *
 * The middleware gate redirects everything else to /onboarding. That redirect
 * is invisible to the wizard's own `fetch` calls — it reads the redirected
 * response as success, advances the step and shows a green tick — so any
 * endpoint the wizard calls that is missing here silently discards the user's
 * work. That is exactly what happened: 8 of the last 10 workspaces reached
 * `onboardingCompleted = true` with no Location row, and no bulk employee
 * import ever landed a row in production.
 *
 * Adding an endpoint here is required whenever the wizard learns to call it.
 * `src/__tests__/lib/onboarding-allowlist.test.ts` asserts the list covers
 * every endpoint the wizard actually fetches.
 */
export const ONBOARDING_ALLOWLIST = [
  "/onboarding",
  "/api/onboarding",
  "/api/billing",
  "/api/auth",
  "/api/health",
  "/einstellungen/abonnement",
  "/workspace-inaktiv",
  "/testphase-abgelaufen",
  "/hard-block",
  "/api/profile", // profile update (name, locale)
  "/api/push-subscriptions", // service-worker registration
  // ── The onboarding wizard's own endpoints ──
  "/api/locations", // step 2 creates the first location
  "/api/employees", // step 3, "one by one"
  "/api/import", // step 3, "Import CSV/Excel" (+ /status polling)
  "/api/public", // step 4 reads plan prices
] as const;

/** True when `pathname` is reachable during an incomplete onboarding. */
export function isOnboardingAllowed(pathname: string): boolean {
  return ONBOARDING_ALLOWLIST.some((p) => pathname.startsWith(p));
}
