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

    // ── Simulation mode: only when explicitly enabled ──
    // Previously this also fell back to simulation when Stripe was unconfigured,
    // which silently swallowed real-payment intent. Now simulation is opt-in only.
    const stripeUnconfigured =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_YOUR") ||
      process.env.STRIPE_SECRET_KEY === "";

    if (isSimulationMode()) {
      await simulateSubscription({
        workspaceId: user.workspaceId,
        plan: planId,
        billingCycle,
      });

      log.info(
        `[Billing:Simulate] Checkout → ${planId} (${billingCycle}) for workspace ${user.workspaceId}`,
      );

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      return NextResponse.json({
        url: `${baseUrl}/einstellungen/abonnement?billing=success`,
        simulation: true,
      });
    }

    if (stripeUnconfigured) {
      log.error(
        "[Billing] STRIPE_SECRET_KEY is missing or invalid — cannot start checkout",
      );
      return NextResponse.json(
        {
          error: "STRIPE_NOT_CONFIGURED",
          message:
            "Bezahlung ist derzeit nicht verfügbar. Bitte später erneut versuchen.",
        },
        { status: 503 },
      );
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

    const baseUrl = (
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
    ).replace(/\/$/, "");

    if (!baseUrl.startsWith("https://")) {
      log.error("[Stripe] checkout aborted — baseUrl is not HTTPS", {
        baseUrl: baseUrl.replace(/\/\/.*/, "//<hidden>"),
      });
      return NextResponse.json(
        {
          error: "INVALID_BASE_URL",
          message:
            "Die App-URL ist nicht korrekt konfiguriert (muss https:// beginnen). Bitte NEXTAUTH_URL in den Vercel-Umgebungsvariablen setzen.",
        },
        { status: 500 },
      );
    }

    const successUrl = `${baseUrl}/einstellungen/abonnement?billing=success`;
    const cancelUrl = `${baseUrl}/einstellungen/abonnement?billing=cancel`;

    log.info("[Stripe] creating checkout session", {
      plan: planId,
      billingCycle,
      priceId,
      successUrl,
      cancelUrl,
      hasCustomerId: !!customerParams.customer,
    });

    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card", "sepa_debit"],
        line_items: [{ price: priceId, quantity: 1 }],
        billing_address_collection: "required",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: user.workspaceId,
        allow_promotion_codes: true,
        tax_id_collection: { enabled: true },
        ...customerParams,
      });

      return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
      const stripeErr = err as {
        message?: string;
        param?: string;
        code?: string;
      };
      const message = stripeErr.message ?? "Stripe checkout failed";
      log.error("[Stripe] checkout.sessions.create failed", {
        error: message,
        param: stripeErr.param,
        code: stripeErr.code,
        plan: planId,
        billingCycle,
        priceId,
        successUrl,
        cancelUrl,
        hasCustomerId: !!customerParams.customer,
      });
      return NextResponse.json(
        {
          error: "STRIPE_CHECKOUT_FAILED",
          message,
          param: stripeErr.param,
        },
        { status: 502 },
      );
    }
  },
  { idempotent: true },
);
