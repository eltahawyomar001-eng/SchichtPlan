import { NextResponse } from "next/server";
import {
  getSubscription,
  ensureSubscription,
  isSimulationMode,
  updateSubscriptionFromStripe,
} from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import { getStripe, getPlanByPriceId, PLANS, type PlanId } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/billing/subscription
 *
 * Returns the current workspace subscription status and plan limits.
 *
 * If ?reconcile=1 is passed and the workspace has a Stripe subscription,
 * the DB is force-synced with the live Stripe state. This is a safety net
 * for missed/delayed webhooks — it guarantees the UI never displays a
 * stale plan after the user has changed it in Stripe.
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

    const reconcile =
      new URL(req.url).searchParams.get("reconcile") === "1" &&
      !isSimulationMode() &&
      !!sub.stripeSubscriptionId &&
      !!process.env.STRIPE_SECRET_KEY;

    if (reconcile && sub.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        const liveSub = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId,
        );
        const mainItem =
          liveSub.items.data.find((it) => getPlanByPriceId(it.price.id)) ??
          liveSub.items.data[0];
        const livePriceId = mainItem?.price.id ?? "";
        const livePlan = livePriceId ? getPlanByPriceId(livePriceId) : null;
        const drifted =
          (livePriceId && livePriceId !== sub.stripePriceId) ||
          (livePlan && livePlan.prismaKey !== sub.plan);

        if (drifted) {
          log.warn("[Billing] reconciling drifted subscription", {
            workspaceId: user.workspaceId,
            dbPlan: sub.plan,
            dbPriceId: sub.stripePriceId,
            livePriceId,
            livePlan: livePlan?.prismaKey,
          });
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
        }
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
      limits: planConfig?.limits ?? PLANS.basic.limits,
      simulationMode: isSimulationMode(),
      reconciled: reconcile,
    });
  },
);
