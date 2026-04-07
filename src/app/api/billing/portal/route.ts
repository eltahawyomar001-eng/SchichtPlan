import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { getStripe } from "@/lib/stripe";
import { getSubscription, isSimulationMode } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so users can manage
 * their subscription, update payment methods, view invoices, etc.
 *
 * In simulation mode, redirects to the billing page with a sim flag.
 */
export const POST = withRoute(
  "/api/billing/portal",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    // In simulation mode, redirect to the billing page
    if (isSimulationMode()) {
      return NextResponse.json({
        url: `${process.env.NEXTAUTH_URL}/einstellungen/abonnement?portal=sim`,
        simulation: true,
      });
    }

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

    createAuditLog({
      action: "CREATE",
      entityType: "BillingPortalSession",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json({ url: portalSession.url });
  },
  { idempotent: true },
);
