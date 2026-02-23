import * as Sentry from "@sentry/nextjs";
import { getStoredConsent } from "@/lib/cookie-consent";

/* ──────────────────────────────────────────────────────────────
 * Sentry Client-Side Init — DSGVO compliant
 *
 * Session replay and performance tracing set third-party cookies
 * and are therefore gated behind the user's analytics consent
 * (Art. 6 (1)(a) DSGVO, § 25 TDDDG).
 *
 * Error monitoring (without replay/tracing) is considered a
 * legitimate interest (Art. 6 (1)(f) DSGVO) for security purposes
 * and runs without consent. It only uses first-party cookies.
 * ────────────────────────────────────────────────────────────── */
const consent = getStoredConsent();
const analyticsAllowed = consent?.analytics ?? false;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Performance tracing — only with consent
  tracesSampleRate: analyticsAllowed ? 0.2 : 0,
  // Session replay — only with consent (sets third-party cookies)
  replaysSessionSampleRate: analyticsAllowed ? 0.1 : 0,
  replaysOnErrorSampleRate: analyticsAllowed ? 1.0 : 0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// Re-configure Sentry when consent changes (user toggles cookies)
if (typeof window !== "undefined") {
  window.addEventListener("cookie-consent-change", () => {
    const updated = getStoredConsent();
    const allowed = updated?.analytics ?? false;
    const client = Sentry.getClient();
    if (client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = client.getOptions() as any;
      opts.tracesSampleRate = allowed ? 0.2 : 0;
      opts.replaysSessionSampleRate = allowed ? 0.1 : 0;
      opts.replaysOnErrorSampleRate = allowed ? 1.0 : 0;
    }
  });
}
