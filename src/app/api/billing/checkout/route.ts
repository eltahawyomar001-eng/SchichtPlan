import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for the given plan.
 *
 * Requires STRIPE_SECRET_KEY env var.
 * Body: { priceId: string }
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

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 501 },
      );
    }

    // Dynamic import so the app doesn't crash if stripe isn't installed
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const { priceId } = await req.json();
    if (!priceId) {
      return NextResponse.json(
        { error: "priceId is required" },
        { status: 400 },
      );
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/einstellungen?billing=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/einstellungen?billing=cancel`,
      client_reference_id: user.workspaceId,
      customer_email: user.email,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
