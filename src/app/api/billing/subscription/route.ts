import { NextResponse } from "next/server";
import {
  getSubscription,
  ensureSubscription,
  isSimulationMode,
  updateSubscriptionFromStripe,
} from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import { getStripe, getPlanByPriceId, PLANS, type PlanId } from "@/lib/stripe";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/billing/subscription
 *
 * Returns the current workspace subscription status and plan limits.
 *
 * If ?reconcile=1 is passed and the workspace has a Stripe subscription,
 * the DB is force-synced with the live Stripe state unconditionally —
 * status, period dates, seatCount, cancelAtPeriodEnd, and plan are all
 * written from live Stripe data. This is the authoritative sync path
 * and runs on every billing page load to keep the UI current without
 * depending solely on webhook delivery.
 */
export const GET = withRoute(
  "/api/billing/subscription",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    let sub = await getSubscription(user.workspaceId);
    if (!sub) sub = await ensureSubscription(user.workspaceId);

    const shouldReconcile =
      new URL(req.url).searchParams.get("reconcile") === "1" &&
      !isSimulationMode() &&
      !!sub.stripeSubscriptionId &&
      !!process.env.STRIPE_SECRET_KEY;

    if (shouldReconcile && sub.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        const liveSub = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId,
        );

        // Find the main plan item — exclude ticketing and schichtplanung addon items.
        // Falls back to first item if no plan item is identifiable (e.g. env vars
        // not yet configured), which is still better than using a stale DB value.
        const mainItem =
          liveSub.items.data.find(
            (it) =>
              !getTicketingTierByPriceId(it.price.id) &&
              !getSchichtplanungBillingByPriceId(it.price.id),
          ) ?? liveSub.items.data[0];

        const livePriceId = mainItem?.price.id ?? "";
        const livePlan = livePriceId ? getPlanByPriceId(livePriceId) : null;

        if (!livePlan && livePriceId) {
          log.warn(
            "[Billing] reconcile: live priceId not found in PLANS config — plan field will not be updated. Check STRIPE_PRICE_* env vars.",
            { workspaceId: user.workspaceId, livePriceId },
          );
        }

        // Always sync all fields unconditionally — period dates, status,
        // seatCount, and cancelAtPeriodEnd change without plan changes
        // (e.g. on invoice renewal, payment method updates, etc.).
        await updateSubscriptionFromStripe({
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripePriceId: livePriceId,
          status: liveSub.status,
          seatCount: mainItem?.quantity ?? sub.seatCount,
          currentPeriodStart: new Date(
            (mainItem?.current_period_start ?? 0) * 1000,
          ),
          currentPeriodEnd: new Date(
            (mainItem?.current_period_end ?? 0) * 1000,
          ),
          cancelAtPeriodEnd: liveSub.cancel_at_period_end,
        });

        if (livePlan) {
          await syncUsageLimits(user.workspaceId, livePlan.id as PlanId);
        }

        sub = await getSubscription(user.workspaceId);
      } catch (err) {
        log.error("[Billing] reconcile failed", {
          error: err instanceof Error ? err.message : String(err),
          workspaceId: user.workspaceId,
        });
      }
    }

    if (!sub) sub = await ensureSubscription(user.workspaceId);

    const planId = sub.plan.toLowerCase() as PlanId;
    const planConfig = PLANS[planId];

    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      seatCount: sub.seatCount,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      trialEnd: sub.trialEnd,
      hasStripeSubscription: !!sub.stripeSubscriptionId,
      ticketingTier: sub.ticketingTier ?? "NONE",
      schichtplanungAddonActive: sub.schichtplanungAddonActive,
      schichtplanungAddonBilling: sub.schichtplanungAddonBilling,
      limits: planConfig?.limits ?? PLANS.basic.limits,
      simulationMode: isSimulationMode(),
      reconciled: shouldReconcile,
    });
  },
);
