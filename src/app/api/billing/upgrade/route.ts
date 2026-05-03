import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { getStripe, getPlanByPriceId, PLANS } from "@/lib/stripe";
import type { PlanId } from "@/lib/stripe";
import {
  getSubscription,
  updateSubscriptionFromStripe,
  isSimulationMode,
  simulateSubscription,
} from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/billing/upgrade
 *
 * Switches the workspace to a different plan in-app without requiring the
 * Stripe Customer Portal. Updates the Stripe subscription item immediately
 * and syncs the DB — the UI reflects the change on the same request,
 * no webhook round-trip needed.
 *
 * Body: { plan: "basic" | "professional"; billingCycle: "monthly" | "annual" }
 *
 * In simulation mode: directly updates DB (no real Stripe call).
 * Enterprise plan changes require contacting sales and are rejected here.
 */
export const POST = withRoute(
  "/api/billing/upgrade",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const body = await req.json();
    const planId = (body.plan as string)?.toLowerCase() as PlanId;
    const billingCycle: "monthly" | "annual" =
      body.billingCycle === "monthly" ? "monthly" : "annual";

    if (!planId || !PLANS[planId]) {
      return NextResponse.json(
        { error: "Invalid plan. Must be basic or professional." },
        { status: 400 },
      );
    }

    if (planId === "enterprise") {
      return NextResponse.json(
        {
          error: "ENTERPRISE_CONTACT_SALES",
          message:
            "Enterprise-Pläne werden individuell konfiguriert. Bitte wenden Sie sich an info@bashabsheh-vergabepartner.de.",
        },
        { status: 422 },
      );
    }

    const sub = await getSubscription(workspaceId);
    if (!sub) {
      return NextResponse.json(
        { error: "No subscription found. Please subscribe first." },
        { status: 404 },
      );
    }

    const planConfig = PLANS[planId];
    const currentPlanId = sub.plan.toLowerCase();

    // In simulation mode: directly update DB
    const stripeUnconfigured =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_YOUR") ||
      process.env.STRIPE_SECRET_KEY === "";

    if (isSimulationMode() || stripeUnconfigured) {
      await simulateSubscription({ workspaceId, plan: planId, billingCycle });
      log.info(
        `[Billing:Simulate] Upgrade ${currentPlanId} → ${planId} (${billingCycle}) for workspace=${workspaceId}`,
      );
      const updated = await getSubscription(workspaceId);
      return NextResponse.json({
        plan: planConfig.prismaKey,
        simulation: true,
        subscription: updated,
      });
    }

    if (!sub.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: "NO_STRIPE_SUBSCRIPTION",
          message:
            "No active Stripe subscription found. Please complete checkout first.",
        },
        { status: 400 },
      );
    }

    const newPriceId =
      billingCycle === "annual"
        ? planConfig.stripePriceIdAnnual
        : planConfig.stripePriceIdMonthly;

    if (!newPriceId) {
      log.error(
        `[Stripe] No price ID configured for plan=${planId} cycle=${billingCycle}`,
      );
      return NextResponse.json(
        {
          error: "PRICE_NOT_CONFIGURED",
          message: "Plan price not configured. Please contact support.",
        },
        { status: 500 },
      );
    }

    const stripe = getStripe();

    try {
      // Retrieve live subscription to find the current main plan item
      const liveSub = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId,
      );

      const mainItem =
        liveSub.items.data.find(
          (it) =>
            !getTicketingTierByPriceId(it.price.id) &&
            !getSchichtplanungBillingByPriceId(it.price.id),
        ) ?? liveSub.items.data[0];

      if (!mainItem) {
        return NextResponse.json(
          {
            error:
              "Could not identify current plan item in Stripe subscription.",
          },
          { status: 500 },
        );
      }

      // Update the plan item price — Stripe handles proration automatically
      const updatedItem = await stripe.subscriptionItems.update(mainItem.id, {
        price: newPriceId,
        quantity: mainItem.quantity ?? sub.seatCount,
        proration_behavior: "create_prorations",
      });

      // Refresh subscription to get the new period dates
      const refreshedSub = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId,
      );

      const refreshedMainItem =
        refreshedSub.items.data.find((it) => it.id === updatedItem.id) ??
        refreshedSub.items.data.find(
          (it) =>
            !getTicketingTierByPriceId(it.price.id) &&
            !getSchichtplanungBillingByPriceId(it.price.id),
        ) ??
        refreshedSub.items.data[0];

      // Sync DB immediately — no webhook round-trip needed
      await updateSubscriptionFromStripe({
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripePriceId: newPriceId,
        status: refreshedSub.status,
        seatCount: refreshedMainItem?.quantity ?? sub.seatCount,
        currentPeriodStart: new Date(
          (refreshedMainItem?.current_period_start ?? 0) * 1000,
        ),
        currentPeriodEnd: new Date(
          (refreshedMainItem?.current_period_end ?? 0) * 1000,
        ),
        cancelAtPeriodEnd: refreshedSub.cancel_at_period_end,
      });

      // Plan is known explicitly here — sync usage limits directly
      await syncUsageLimits(workspaceId, planId);

      const updatedSub = await getSubscription(workspaceId);

      log.info(
        `[Stripe] Plan upgraded: workspace=${workspaceId} ${currentPlanId} → ${planId} (${billingCycle})`,
      );

      return NextResponse.json({
        plan: planConfig.prismaKey,
        subscription: updatedSub,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("[Stripe] Upgrade failed", {
        error: msg,
        workspaceId,
        planId,
        billingCycle,
      });
      return NextResponse.json(
        { error: "STRIPE_UPGRADE_FAILED", message: msg },
        { status: 502 },
      );
    }
  },
  { idempotent: true },
);
