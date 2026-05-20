/**
 * Cookie Consent Manager
 * ──────────────────────
 * GDPR / DSGVO / TDDDG (§ 25) compliant consent management.
 *
 * Categories:
 *   - necessary:   Always on (session, CSRF, locale, billing). No consent needed
 *                  (§ 25 Abs. 2 Nr. 2 TDDDG — strictly necessary for service).
 *   - functional:  Non-essential preferences (theme, language, UI hints).
 *                  Improves UX but app works without them.
 *   - analytics:   Performance & error tracking (Sentry). Aggregated metrics.
 *   - marketing:   Conversion tracking, retargeting, ad pixels. Off by default.
 *
 * Consent is stored in:
 *   - localStorage ("cookie-consent") — for client reads
 *   - A first-party cookie ("cookie-consent") — for server reads / expiry
 *
 * Legal basis: Art. 6 (1)(a) DSGVO — consent. Art. 7 DSGVO — conditions for consent.
 * The version is bumped (=3) to force re-consent now that categories changed.
 */

export interface CookieConsent {
  necessary: true; // always true, cannot be toggled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string; // ISO date of consent action
  version: number; // bump when categories change — triggers re-consent
}

export type CookieCategory =
  | "necessary"
  | "functional"
  | "analytics"
  | "marketing";

export const CONSENT_VERSION = 3;
export const CONSENT_KEY = "cookie-consent";
export const CONSENT_COOKIE_DAYS = 365;

const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  timestamp: new Date().toISOString(),
  version: CONSENT_VERSION,
};

/** Read stored consent (returns null if none given yet). */
export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CookieConsent>;

    // Re-consent needed if version changed
    if (parsed.version !== CONSENT_VERSION) return null;

    // Backfill any missing keys defensively (forward-compat older saved state)
    return {
      necessary: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      timestamp: parsed.timestamp ?? new Date().toISOString(),
      version: CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

/** Persist consent to localStorage + cookie. */
export function saveConsent(consent: Partial<CookieConsent>): void {
  if (typeof window === "undefined") return;

  const data: CookieConsent = {
    necessary: true,
    functional: Boolean(consent.functional),
    analytics: Boolean(consent.analytics),
    marketing: Boolean(consent.marketing),
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  localStorage.setItem(CONSENT_KEY, JSON.stringify(data));

  // Set a first-party cookie so the server can read consent status
  const expires = new Date();
  expires.setDate(expires.getDate() + CONSENT_COOKIE_DAYS);
  document.cookie = `${CONSENT_KEY}=${encodeURIComponent(JSON.stringify(data))}; path=/; expires=${expires.toUTCString()}; SameSite=Lax; Secure`;

  // Dispatch event so Sentry and other scripts can react
  window.dispatchEvent(
    new CustomEvent("cookie-consent-change", { detail: data }),
  );
}

/** Accept all categories. */
export function acceptAll(): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  saveConsent(consent);
  return consent;
}

/** Accept only necessary cookies. */
export function rejectAll(): CookieConsent {
  const consent: CookieConsent = { ...DEFAULT_CONSENT };
  saveConsent(consent);
  return consent;
}

/** Check if the user has given analytics consent. */
export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics ?? false;
}

/** Check if the user has given functional consent. */
export function hasFunctionalConsent(): boolean {
  return getStoredConsent()?.functional ?? false;
}

/** Check if the user has given marketing consent. */
export function hasMarketingConsent(): boolean {
  return getStoredConsent()?.marketing ?? false;
}

/** Check if the user has made any consent choice (to show/hide banner). */
export function hasConsentChoice(): boolean {
  return getStoredConsent() !== null;
}
