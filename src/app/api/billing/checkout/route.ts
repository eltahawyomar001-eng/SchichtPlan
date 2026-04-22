import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { getStripe, getPlanByPriceId, PLANS } from "@/lib/stripe";
import {
  ensureSubscription,
  isSimulationMode,
  simulateSubscription,
} from "@/lib/subscription";
import type { PlanId } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { checkIdempotency, cacheIdempotentResponse } from "@/lib/idempotency";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/billing/checkout
 *
 * Handles both simulation mode (STRIPE_SIMULATION_MODE=true) and
 * real Stripe checkout. In simulation mode no real payment is processed.
 *
 * Body: { plan: string; billingCycle: "monthly"|"annual"; priceId?: string }
 */
export const POST = withRoute(
  "/api/billing/checkout",
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
        {
          error: "Invalid plan. Must be basic, professional, or enterprise.",
        },
        { status: 400 },
      );
    }

    // ── Simulation mode: skip Stripe entirely ──
    // Active when STRIPE_SIMULATION_MODE=true OR when Stripe price IDs are not configured
    const stripeUnconfigured =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_YOUR") ||
      process.env.STRIPE_SECRET_KEY === "";

    if (isSimulationMode() || stripeUnconfigured) {
      await simulateSubscription({
        workspaceId: user.workspaceId,
        plan: planId,
        billingCycle,
      });

      log.info(
        `[Billing:Simulate] Checkout → ${planId} (${billingCycle}) for workspace ${user.workspaceId}`,
      );

      const baseUrl =
        (process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL)
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      return NextResponse.json({
        url: `${process.env.NEXTAUTH_URL ?? baseUrl}/einstellungen/abonnement?billing=success`,
        simulation: true,
      });
    }

    // ── Real Stripe checkout ──
    const stripe = getStripe();

    const planConfig = PLANS[planId];
    const priceId =
      billingCycle === "annual"
        ? planConfig.stripePriceIdAnnual
        : planConfig.stripePriceIdMonthly;

    if (!priceId) {
      log.error(
        `[Stripe] No price ID configured for plan=${planId} cycle=${billingCycle}`,
      );
      return NextResponse.json(
        { error: "Plan price not configured. Please contact support." },
        { status: 500 },
      );
    }

    // Validate the price ID maps to a known plan
    const resolvedPlan = getPlanByPriceId(priceId);
    if (!resolvedPlan) {
      return NextResponse.json(
        { error: "Invalid price configuration" },
        { status: 400 },
      );
    }

    // Ensure subscription row exists
    const sub = await ensureSubscription(user.workspaceId);

    const customerParams: Record<string, string> = {};
    if (sub.stripeCustomerId) {
      customerParams.customer = sub.stripeCustomerId;
    } else {
      customerParams.customer_email = user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "required", // needed for valid DE invoice
      subscription_data: {
        trial_period_days: resolvedPlan.trialDays || undefined,
      },
      invoice_creation: { enabled: true }, // always generate a downloadable invoice PDF
      success_url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement?billing=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement?billing=cancel`,
      client_reference_id: user.workspaceId,
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      ...customerParams,
    });

    const response = NextResponse.json({ url: checkoutSession.url });
    return response;
  },
  { idempotent: true },
);
