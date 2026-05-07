# Secrets Rotation Policy

**Owner:** Engineering Lead
**Cadence:** Every 90 days, or immediately on suspected leak.

---

## Why this exists

Static secrets that never rotate are the second-most-common path to a SaaS
breach (after stolen developer credentials). A 90-day rotation cadence
limits the blast radius of any leak to one quarter of customer activity.

## Rotation Calendar

| Quarter | Date       | Owner |
| ------- | ---------- | ----- |
| Q1      | January 15 |       |
| Q2      | April 15   |       |
| Q3      | July 15    |       |
| Q4      | October 15 |       |

Add a recurring calendar event so this does not slip.

## Secrets In Scope

### Critical — rotate every 90 days

- `NEXTAUTH_SECRET` — signs all session cookies. Rotation invalidates every
  active session (forces all users to log in again). Schedule for low-traffic
  windows (Sunday morning).
- `ENCRYPTION_KEY` — encrypts data at rest in the application layer
  (TwoFactorSecret etc.). Rotation requires a re-encryption migration if
  used. **Do not rotate without a migration plan.**
- `STRIPE_WEBHOOK_SECRET` — Stripe-managed; rotate by deleting and recreating
  the webhook endpoint in Stripe Dashboard.

### High — rotate every 90 days, low impact

- `PIN_SECRET` — HMAC for employee PINs. Rotation forces all employees to
  receive a new PIN reveal link (no actual data loss).
- `QR_TOKEN_SECRET` — HMAC for QR clock tokens. 60-second token TTL means
  rotation has a 60-second tail of failed clocks; effectively zero impact.
- `STATION_SECRET` — HMAC for station setup/access tokens. Rotation forces
  re-pairing of all kiosk devices (~5 min per device).
- `CRON_SECRET` — Vercel cron auth header. Rotate via Vercel dashboard.

### External — rotate per provider policy

- `STRIPE_SECRET_KEY` — rotate via Stripe Dashboard → Developers → API keys
  → "Roll" button. Stripe gives a 30-day overlap window where both old and
  new keys work.
- `RESEND_API_KEY` — rotate via Resend Dashboard. Update Vercel env, redeploy.
- `UPSTASH_REDIS_REST_TOKEN` — rotate via Upstash Console → Database →
  REST API → "Reset Token".
- OAuth client secrets (`GOOGLE_CLIENT_SECRET`, `AZURE_AD_CLIENT_SECRET`) —
  rotate per provider's UI.
- `SENTRY_AUTH_TOKEN` — used only for source map uploads at build time;
  rotate annually unless suspected leak.

## Standard Rotation Procedure

For each secret:

1. **Generate new value** — use the provider UI (Stripe, Resend, etc.) or
   `openssl rand -hex 32` for HMAC secrets.
2. **Add new env var to Vercel** with both old and new values (e.g.,
   `STRIPE_SECRET_KEY` and `STRIPE_SECRET_KEY_NEXT`). Update code to accept
   either if dual-key support is needed.
3. **Redeploy** — env changes only take effect on new instances.
4. **Verify** — run smoke tests confirming the new secret works.
5. **Remove the old value** from Vercel after the overlap window.
6. **Redeploy again** to remove the old value from running instances.
7. **Log the rotation** in `docs/SECRETS-ROTATION-LOG.md` (date, secret,
   operator, outcome).

## Emergency Rotation (Suspected Leak)

If a secret is suspected leaked:

1. **STOP** — do not redeploy with the leaked secret still active.
2. Rotate immediately via the provider UI (do not wait for the standard procedure).
3. Update Vercel env, redeploy.
4. Audit logs for the affected period (Sentry, Stripe events, database
   audit log). Look for unauthorized access patterns.
5. If user data was exposed, follow the GDPR Art. 33 incident notification
   procedure (notify supervisory authority within 72 hours).
6. Open a post-mortem within 48 hours. Use the template in
   `docs/POST-MORTEM-TEMPLATE.md`.

## Storage Hygiene

- **Never** commit a `.env` file to git. The `.gitignore` excludes it but
  verify before every commit.
- Vercel is the source of truth for production secrets. Local dev should use
  separate test-mode values.
- No secret should appear in any log output. Sentry beforeSend redacts known
  fields; new secrets must be added to the redaction list.
- Rotation is a paper trail — the log file proves to auditors (SOC2 / ISO 27001)
  that the policy is followed.
