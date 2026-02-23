import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, getPlanByPriceId } from "@/lib/stripe";
import type { PlanId } from "@/lib/stripe";
import {
  activateSubscription,
  updateSubscriptionFromStripe,
  cancelSubscription,
} from "@/lib/subscription";

/**
 * POST /api/billing/webhook
 * Stripe webhook handler. Verifies signature then processes events
 * and persists subscription state to the database.
 *
 * Requires env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Stripe webhook secret not configured" },
        { status: 501 },
      );
    }

    const stripe = getStripe();
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 },
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[Stripe] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      /* ─── Checkout completed → activate subscription ─── */
      case "checkout.session.completed": {
        const session = event.data.object;
        const workspaceId = session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (!workspaceId || !subscriptionId || !customerId) {
          console.warn("[Stripe] Missing data in checkout session");
          break;
        }

        // Fetch full subscription details from Stripe
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const item = sub.items.data[0];
        const priceId = item?.price.id;
        const plan = priceId ? getPlanByPriceId(priceId) : undefined;

        await activateSubscription({
          workspaceId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId ?? "",
          plan: (plan?.id ?? "team") as PlanId,
          seatCount: item?.quantity ?? 1,
          currentPeriodStart: new Date(
            (item?.current_period_start ?? 0) * 1000,
          ),
          currentPeriodEnd: new Date((item?.current_period_end ?? 0) * 1000),
          trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          status: sub.status,
        });

        console.log(
          `[Stripe] Activated: workspace=${workspaceId} plan=${plan?.id ?? "unknown"}`,
        );
        break;
      }

      /* ─── Subscription updated → sync status ─── */
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const updItem = sub.items.data[0];
        const priceId = updItem?.price.id;

        await updateSubscriptionFromStripe({
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId ?? "",
          status: sub.status,
          seatCount: updItem?.quantity ?? 1,
          currentPeriodStart: new Date(
            (updItem?.current_period_start ?? 0) * 1000,
          ),
          currentPeriodEnd: new Date((updItem?.current_period_end ?? 0) * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });

        console.log(`[Stripe] Updated: ${sub.id} → ${sub.status}`);
        break;
      }

      /* ─── Subscription deleted → downgrade to free ─── */
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await cancelSubscription(sub.id);
        console.log(`[Stripe] Cancelled: ${sub.id}`);
        break;
      }

      /* ─── Payment failed → log for alerting ─── */
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.error(`[Stripe] Payment failed: invoice=${invoice.id}`);
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe] Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
