import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { getStripe } from "@/lib/stripe";
import {
  linkSubscriptionByCustomer,
  updateSubscriptionFromStripe,
  getSubscription,
} from "@/lib/subscription";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/sync
 *
 * Manually re-fetches the workspace's Stripe subscription state and syncs it
 * to the database. Call this after a successful Stripe Checkout redirect to
 * immediately unlock features without waiting for the webhook.
 *
 * Rate-limited: max 3 calls per hour per workspace (enforced by withRoute).
 */
export const POST = withRoute("/api/billing/sync", "POST", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const sub = await getSubscription(workspaceId);
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ synced: false, reason: "NO_CUSTOMER" });
  }

  const stripe = getStripe();

  try {
    const stripeSubs = await stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: "active",
      limit: 1,
      expand: ["data.items"],
    });

    if (stripeSubs.data.length === 0) {
      // Check trialing
      const trialSubs = await stripe.subscriptions.list({
        customer: sub.stripeCustomerId,
        status: "trialing",
        limit: 1,
        expand: ["data.items"],
      });
      if (trialSubs.data.length === 0) {
        return NextResponse.json({ synced: false, reason: "NO_ACTIVE_SUB" });
      }
      stripeSubs.data.push(trialSubs.data[0]);
    }

    const liveSub = stripeSubs.data[0];
    const mainItem =
      liveSub.items.data.find(
        (it) =>
          !getTicketingTierByPriceId(it.price.id) &&
          !getSchichtplanungBillingByPriceId(it.price.id),
      ) ?? liveSub.items.data[0];

    if (sub.stripeSubscriptionId && sub.stripeSubscriptionId === liveSub.id) {
      await updateSubscriptionFromStripe({
        stripeSubscriptionId: liveSub.id,
        stripePriceId: mainItem?.price.id ?? "",
        status: liveSub.status,
        seatCount: mainItem?.quantity ?? sub.seatCount,
        currentPeriodStart: new Date(
          (mainItem?.current_period_start ?? 0) * 1000,
        ),
        currentPeriodEnd: new Date((mainItem?.current_period_end ?? 0) * 1000),
        cancelAtPeriodEnd: liveSub.cancel_at_period_end,
      });
    } else {
      await linkSubscriptionByCustomer({
        stripeCustomerId: sub.stripeCustomerId,
        stripeSubscriptionId: liveSub.id,
        stripePriceId: mainItem?.price.id ?? "",
        status: liveSub.status,
        seatCount: mainItem?.quantity ?? sub.seatCount,
        currentPeriodStart: new Date(
          (mainItem?.current_period_start ?? 0) * 1000,
        ),
        currentPeriodEnd: new Date((mainItem?.current_period_end ?? 0) * 1000),
        cancelAtPeriodEnd: liveSub.cancel_at_period_end,
      });
    }

    log.info("[Billing:Sync] manual sync completed", {
      workspaceId,
      subId: liveSub.id,
    });
    return NextResponse.json({ synced: true, status: liveSub.status });
  } catch (err) {
    log.error("[Billing:Sync] sync failed", { err, workspaceId });
    return NextResponse.json(
      { synced: false, reason: "STRIPE_ERROR" },
      { status: 502 },
    );
  }
});
