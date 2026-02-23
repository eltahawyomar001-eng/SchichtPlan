import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { getStripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so users can manage
 * their subscription, update payment methods, view invoices, etc.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const sub = await getSubscription(user.workspaceId);
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      );
    }

    const stripe = getStripe();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    log.error("[Stripe] Portal error:", { error: error });
    return NextResponse.json(
      { error: "Portal session failed" },
      { status: 500 },
    );
  }
}
