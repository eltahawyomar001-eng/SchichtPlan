import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * POST /api/billing/webhook
 * Stripe webhook handler. Verifies signature then processes events.
 *
 * Requires env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 501 },
      );
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(
          `[Stripe] Checkout completed for workspace: ${session.client_reference_id}`,
        );
        // TODO: Update workspace subscription status in DB
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log(
          `[Stripe] Subscription updated: ${subscription.id}, status: ${subscription.status}`,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log(`[Stripe] Subscription cancelled: ${subscription.id}`);
        // TODO: Downgrade workspace to free tier
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`[Stripe] Payment failed for invoice: ${invoice.id}`);
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
