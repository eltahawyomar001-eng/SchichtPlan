import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { getStripe, getPlanByPriceId } from "@/lib/stripe";
import {
  ensureSubscription,
  isSimulationMode,
  simulateSubscription,
} from "@/lib/subscription";
import type { PlanId } from "@/lib/stripe";
import { PLANS } from "@/lib/stripe";
import { checkoutSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for the given plan.
 *
 * Body: { priceId: string; quantity?: number }
 * quantity = number of seats (defaults to active employee count).
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const body = await req.json();

    // ── Simulation mode: skip Stripe entirely ──
    if (isSimulationMode()) {
      const planId = (body.plan as string)?.toLowerCase() as PlanId;
      const billingCycle = body.billingCycle ?? "monthly";

      if (!planId || !PLANS[planId]) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }

      await simulateSubscription({
        workspaceId: user.workspaceId,
        plan: planId,
        billingCycle,
      });

      log.info(
        `[Billing:Simulate] Checkout → ${planId} (${billingCycle}) for workspace ${user.workspaceId}`,
      );

      // Return the success URL so the UI redirects back to the billing page
      return NextResponse.json({
        url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement?billing=success`,
        simulation: true,
      });
    }

    const stripe = getStripe();

    const parsed = validateBody(checkoutSchema, body);
    if (!parsed.success) return parsed.response;
    const { priceId, quantity } = parsed.data;

    // Validate the price ID maps to a known plan
    const plan = getPlanByPriceId(priceId);
    if (!plan) {
      return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
    }

    // Ensure subscription row exists
    const sub = await ensureSubscription(user.workspaceId);

    // If workspace already has a Stripe customer, reuse it
    const customerParams: Record<string, string> = {};
    if (sub.stripeCustomerId) {
      customerParams.customer = sub.stripeCustomerId;
    } else {
      customerParams.customer_email = user.email;
    }

    const seatCount = quantity ?? 1;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{ price: priceId, quantity: seatCount }],
      subscription_data: {
        trial_period_days: plan.trialDays || undefined,
      },
      success_url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement?billing=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement?billing=cancel`,
      client_reference_id: user.workspaceId,
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      ...customerParams,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    log.error("[Stripe] Checkout error:", { error: error });
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
