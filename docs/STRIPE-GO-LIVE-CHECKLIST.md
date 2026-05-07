# Stripe Test → Live Mode Migration Checklist

**Owner:** Engineering Lead
**Estimated time:** 30–60 minutes
**Reversibility:** Difficult — once live, you cannot easily revert without
clearing real customer data. Run through this in staging first.

---

## Pre-Flight (Day Before)

- [ ] Confirm Stripe account is verified for live payouts (Stripe Dashboard
      → Settings → Account details → identity verified, bank account confirmed).
- [ ] Confirm tax registration is complete in Stripe Tax (or that
      `tax_id_collection` is correctly configured for your VAT setup).
- [ ] Verify products and prices exist in **live mode**. Live-mode price IDs
      are different from test-mode price IDs.
- [ ] Run a full end-to-end test in test mode one last time:
      registration → checkout → webhook → subscription active → portal →
      cancel → verify state.
- [ ] Confirm `STRIPE_SIMULATION_MODE` is unset or `false` in production env.

## Required Environment Variables in Production

Replace the test-mode values with live-mode values. **Do not mix.**

| Variable                                  | Test value example | Live value source                    |
| ----------------------------------------- | ------------------ | ------------------------------------ |
| `STRIPE_SECRET_KEY`                       | `sk_test_…`        | Live → Developers → API keys         |
| `STRIPE_WEBHOOK_SECRET`                   | `whsec_…` (test)   | Live webhook endpoint signing secret |
| `STRIPE_PRICE_BASIC_MONTHLY`              | `price_test_…`     | Live → Products → Basic monthly      |
| `STRIPE_PRICE_BASIC_ANNUAL`               | `price_test_…`     | Live → Products → Basic annual       |
| `STRIPE_PRICE_PROFESSIONAL_MONTHLY`       | `price_test_…`     | Live                                 |
| `STRIPE_PRICE_PROFESSIONAL_ANNUAL`        | `price_test_…`     | Live                                 |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY`         | `price_test_…`     | Live                                 |
| `STRIPE_PRICE_ENTERPRISE_ANNUAL`          | `price_test_…`     | Live                                 |
| Add-on prices (ticketing, schichtplanung) | `price_test_…`     | Live                                 |

## Webhook Setup in Live Mode

1. In Stripe Dashboard → switch to **Live mode** (toggle top-left).
2. Developers → Webhooks → **+ Add endpoint**.
3. Endpoint URL: `https://shiftfy.de/api/billing/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.updated`
5. Copy the **signing secret** (`whsec_…`) and set as `STRIPE_WEBHOOK_SECRET`
   in Vercel production environment.
6. **Important:** Do not delete the test-mode webhook — it stays attached to
   test mode and is harmless.

## Deployment Sequence (in order)

1. Set all live-mode env vars in Vercel → Production environment only.
2. **Trigger a redeploy** (env var changes do not take effect on running
   instances). Use Vercel → Deployments → … → Redeploy.
3. Verify `/api/health` returns 200 and reports Stripe as reachable.
4. In Stripe Live → Developers → Webhooks → endpoint → "Send test webhook"
   with `checkout.session.completed`. Confirm 200 in the webhook logs and
   no Sentry errors.

## Smoke Test in Production

- [ ] Open an incognito browser. Register a new test workspace.
- [ ] Go through checkout with a real (low-value) card or use Stripe's
      live-mode-only test cards if available in your region.
- [ ] Confirm subscription becomes ACTIVE in DB.
- [ ] Confirm an invoice row was created with `pdfUrl` populated.
- [ ] Confirm the customer received the invoice email.
- [ ] Refund the test charge in Stripe Dashboard.

## Post-Launch Monitoring (First 48 Hours)

- [ ] Check Sentry every few hours for any new error tagged `route:/api/billing/*`.
- [ ] Watch the Stripe webhook event log — every event must show 200.
- [ ] Watch BetterStack uptime — 99.9%+ on `/api/health`.
- [ ] Verify the first real customer's invoice arrived correctly.

## Rollback Plan

If something goes critically wrong:

1. Set `STRIPE_SIMULATION_MODE=true` to disable all real Stripe calls.
2. Redeploy.
3. Affected real charges in the brief window must be refunded manually
   from the Stripe Dashboard.
4. Investigate, fix, redeploy without simulation.

## Idempotency Notes

- `POST /api/billing/upgrade` and `POST /api/billing/portal` use the
  `withRoute({ idempotent: true })` wrapper.
- Webhook deduplication is via Upstash Redis, 5-minute TTL keyed on event ID.
- If Upstash is unreachable, the in-memory fallback Map deduplicates within a
  single instance (acceptable for SEV3 degradation).

## Known Sharp Edges

- Customers created in test mode have IDs starting `cus_test_…`. They will not
  exist in live mode. The first `subscription.findUnique` call after migration
  will include simulated customer IDs. The checkout route's
  "stale customer ID" retry logic (search for `No such customer`) handles this
  automatically — but expect a small spike in retries on Day 1.
- Trial periods: `trialDays: 7` is honoured by Stripe Checkout via
  `subscription_data.trial_period_days`. If you change `trialDays` after a
  customer has already started a trial, the customer's existing trial is **not**
  retroactively adjusted — only new subscriptions.
- Tax: `tax_id_collection: { enabled: true }` is on. Confirm Stripe Tax is
  configured for your jurisdiction or remove this if you handle VAT manually.
