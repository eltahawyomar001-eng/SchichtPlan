/* ═══════════════════════════════════════════════════════════════
   Subscription reconcile — heal drift from missed Stripe webhooks
   ═══════════════════════════════════════════════════════════════
   Single source of truth for "fetch the workspace's live Stripe
   subscription state and make the DB match it".

   Used by:
     - POST /api/billing/sync                 (user-triggered, after checkout)
     - GET  /api/cron/reconcile-subscriptions (scheduled self-heal)

   Stripe retries failed webhooks for up to 72h, then gives up. If a
   delivery is permanently lost (deploy window, outage) the DB can drift
   in two directions:

     1. Customer PAID but DB shows no active sub  → false paywall
     2. Customer CHURNED but DB still grants access → revenue leak / theft

   `billing/sync` historically only healed (1). This module heals BOTH:
   when Stripe reports the linked subscription is terminal (canceled /
   incomplete_expired) and the DB still grants access, we downgrade.

   The downgrade path is deliberately conservative — it only fires when
   we can positively confirm a terminal status on the *specific* linked
   subscription, never merely because a list query came back empty.
   ═══════════════════════════════════════════════════════════════ */

import { getStripe } from "@/lib/stripe";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
import {
  getSubscription,
  updateSubscriptionFromStripe,
  linkSubscriptionByCustomer,
  cancelSubscription,
  invalidateSubscriptionCache,
  ACTIVE_SUBSCRIPTION_STATUSES,
} from "@/lib/subscription";
import { log } from "@/lib/logger";

/** Stripe statuses that should keep the workspace's access live. */
const SYNCABLE = ["active", "trialing", "past_due", "unpaid"];

/** Stripe statuses that mean the subscription is dead and access must end. */
const TERMINAL = ["canceled", "incomplete_expired"];

export type ReconcileAction =
  | "synced" // DB updated to match a live Stripe subscription
  | "downgraded" // linked sub is terminal in Stripe → DB set to CANCELED
  | "noop" // already in sync, nothing to do
  | "skipped"; // no Stripe customer / not reconcilable

export interface ReconcileResult {
  action: ReconcileAction;
  reason?: string;
  status?: string;
}

/**
 * Reconcile a single workspace's subscription against live Stripe state.
 *
 * @param workspaceId  workspace to reconcile
 * @param opts.allowDowngrade  when true, a confirmed-terminal linked
 *        subscription downgrades the DB to CANCELED. The user-facing
 *        `billing/sync` route leaves this off (it should never revoke a
 *        user's own access mid-session); the scheduled cron turns it on.
 */
export async function reconcileWorkspaceFromStripe(
  workspaceId: string,
  opts: { allowDowngrade?: boolean } = {},
): Promise<ReconcileResult> {
  const { allowDowngrade = false } = opts;

  const sub = await getSubscription(workspaceId);
  if (!sub?.stripeCustomerId) {
    return { action: "skipped", reason: "NO_CUSTOMER" };
  }

  const stripe = getStripe();

  // Fetch all non-deleted subscriptions for the customer. status:"all"
  // surfaces past_due/unpaid (dunning) so a recovering customer is not
  // wrongly treated as lapsed.
  const allSubs = await stripe.subscriptions.list({
    customer: sub.stripeCustomerId,
    status: "all",
    limit: 10,
    expand: ["data.items"],
  });

  const ranked = allSubs.data
    .filter((s) => SYNCABLE.includes(s.status))
    .sort((a, b) => {
      const rank = (s: string) =>
        s === "active" ? 0 : s === "trialing" ? 1 : s === "past_due" ? 2 : 3;
      return rank(a.status) - rank(b.status);
    });

  // ── Path 1: a live (access-granting) subscription exists → sync to it ──
  if (ranked.length > 0) {
    const liveSub = ranked[0];
    const mainItem =
      liveSub.items.data.find(
        (it) =>
          !getTicketingTierByPriceId(it.price.id) &&
          !getSchichtplanungBillingByPriceId(it.price.id),
      ) ?? liveSub.items.data[0];

    const payload = {
      stripeSubscriptionId: liveSub.id,
      stripePriceId: mainItem?.price.id ?? "",
      status: liveSub.status,
      seatCount: mainItem?.quantity ?? sub.seatCount,
      currentPeriodStart: new Date(
        (mainItem?.current_period_start ?? 0) * 1000,
      ),
      currentPeriodEnd: new Date((mainItem?.current_period_end ?? 0) * 1000),
      cancelAtPeriodEnd: liveSub.cancel_at_period_end,
    };

    if (sub.stripeSubscriptionId && sub.stripeSubscriptionId === liveSub.id) {
      await updateSubscriptionFromStripe(payload);
    } else {
      await linkSubscriptionByCustomer({
        stripeCustomerId: sub.stripeCustomerId,
        ...payload,
      });
    }
    await invalidateSubscriptionCache(workspaceId);
    return { action: "synced", status: liveSub.status };
  }

  // ── Path 2: no live subscription. Heal "churned-but-still-active" drift ──
  //
  // Only act when the DB currently *grants* access — otherwise there is
  // nothing to revoke. And only when we can positively confirm the linked
  // subscription is terminal in Stripe. We never downgrade an in-app trial
  // (stripeSubscriptionId === null); the cron/expire-trials job owns those.
  const dbGrantsAccess = (
    ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]
  ).includes(sub.status);

  if (
    allowDowngrade &&
    dbGrantsAccess &&
    sub.stripeSubscriptionId &&
    !sub.stripeSubscriptionId.startsWith("sim_")
  ) {
    // Confirm the *specific* linked subscription is dead before revoking.
    // A list query coming back empty is not sufficient proof (pagination,
    // API hiccups) — retrieve the exact id.
    let confirmedTerminal = false;
    try {
      const linked = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId,
      );
      confirmedTerminal = TERMINAL.includes(linked.status);
    } catch (err: unknown) {
      // A 404 (resource_missing) means Stripe has no record of this sub at
      // all — treat as terminal. Any other error is inconclusive: leave the
      // DB untouched and let the next run retry.
      const code = (err as { code?: string })?.code;
      if (code === "resource_missing") {
        confirmedTerminal = true;
      } else {
        log.warn("[Billing:Reconcile] inconclusive terminal check — skipping", {
          workspaceId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          err,
        });
        return { action: "skipped", reason: "TERMINAL_CHECK_FAILED" };
      }
    }

    if (confirmedTerminal) {
      await cancelSubscription(sub.stripeSubscriptionId);
      await invalidateSubscriptionCache(workspaceId);
      log.info("[Billing:Reconcile] downgraded churned workspace", {
        workspaceId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      });
      return { action: "downgraded" };
    }
  }

  return { action: "noop", reason: "NO_ACTIVE_SUB" };
}
