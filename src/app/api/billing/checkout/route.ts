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
import { prisma } from "@/lib/db";

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
          error:
            "Ungültiger Plan. Muss basic, professional oder enterprise sein.",
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
        {
          error:
            "Planpreis nicht konfiguriert. Bitte wenden Sie sich an den Support.",
        },
        { status: 500 },
      );
    }

    // Validate the price ID maps to a known plan
    const resolvedPlan = getPlanByPriceId(priceId);
    if (!resolvedPlan) {
      return NextResponse.json(
        { error: "Ungültige Preiskonfiguration." },
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

    // Derive base URL from the actual request so it's always correct on Vercel,
    // regardless of how NEXTAUTH_URL is configured.
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      new URL(req.url).host;
    const baseUrl = `${proto}://${host}`;

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

    const sessionParams = {
      mode: "subscription" as const,
      payment_method_types: ["card", "sepa_debit"] as ["card", "sepa_debit"],
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "required" as const,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.workspaceId,
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      ...(planConfig.trialDays > 0
        ? { subscription_data: { trial_period_days: planConfig.trialDays } }
        : {}),
      ...customerParams,
    };

    try {
      const checkoutSession =
        await stripe.checkout.sessions.create(sessionParams);
      return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
      const stripeErr = err as {
        message?: string;
        param?: string;
        code?: string;
      };
      const message = stripeErr.message ?? "Stripe checkout failed";

      // Stale customer ID (e.g. from simulation mode) — clear it and retry with email
      if (message.includes("No such customer") && customerParams.customer) {
        log.warn("[Stripe] stale customerId detected, clearing and retrying", {
          customerId: customerParams.customer,
        });
        await prisma.subscription.update({
          where: { workspaceId: user.workspaceId },
          data: { stripeCustomerId: null, stripeSubscriptionId: null },
        });
        const retryParams = {
          ...sessionParams,
          customer: undefined,
          customer_email: user.email,
        };
        try {
          const retrySession =
            await stripe.checkout.sessions.create(retryParams);
          return NextResponse.json({ url: retrySession.url });
        } catch (retryErr) {
          const retryMsg =
            retryErr instanceof Error
              ? retryErr.message
              : "Stripe checkout failed";
          log.error("[Stripe] retry after clearing customerId also failed", {
            error: retryMsg,
          });
          return NextResponse.json(
            { error: "STRIPE_CHECKOUT_FAILED", message: retryMsg },
            { status: 502 },
          );
        }
      }

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
        { error: "STRIPE_CHECKOUT_FAILED", message, param: stripeErr.param },
        { status: 502 },
      );
    }
  },
  { idempotent: true },
);
