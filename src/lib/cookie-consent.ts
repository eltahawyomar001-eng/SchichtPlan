/**
 * Cookie Consent Manager
 * ──────────────────────
 * GDPR / DSGVO / TDDDG (§ 25) compliant consent management.
 *
 * Categories:
 *   - necessary:   Always on (session, CSRF, locale). No consent needed (§ 25 Abs. 2 Nr. 2 TDDDG).
 *   - analytics:    Performance & error tracking (Sentry). Requires opt-in.
 *
 * Consent is stored in:
 *   - localStorage ("cookie-consent") — for client reads
 *   - A first-party cookie ("cookie-consent") — for server reads / expiry
 *
 * Legal basis: Art. 6 (1)(a) DSGVO — consent. Art. 7 DSGVO — conditions for consent.
 */

export interface CookieConsent {
  necessary: true; // always true, cannot be toggled
  analytics: boolean;
  timestamp: string; // ISO date of consent action
  version: number; // bump when categories change — triggers re-consent
}

export const CONSENT_VERSION = 2;
export const CONSENT_KEY = "cookie-consent";
export const CONSENT_COOKIE_DAYS = 365;

const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  analytics: false,
  timestamp: new Date().toISOString(),
  version: CONSENT_VERSION,
};

/** Read stored consent (returns null if none given yet). */
export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CookieConsent;

    // Re-consent needed if version changed
    if (parsed.version !== CONSENT_VERSION) return null;

    return parsed;
  } catch {
    return null;
  }
}

/** Persist consent to localStorage + cookie. */
export function saveConsent(consent: CookieConsent): void {
  if (typeof window === "undefined") return;

  const data: CookieConsent = {
    ...consent,
    necessary: true,
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
    analytics: true,
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

/** Check if the user has made any consent choice (to show/hide banner). */
export function hasConsentChoice(): boolean {
  return getStoredConsent() !== null;
}
