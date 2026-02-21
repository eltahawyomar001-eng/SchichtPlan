import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so users can manage
 * their subscription, update payment methods, etc.
 *
 * Body: { customerId: string }
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

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const { customerId } = await req.json();
    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 },
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXTAUTH_URL}/einstellungen`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json({ error: "Portal failed" }, { status: 500 });
  }
}
