import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { getStripe } from "@/lib/stripe";
import { getSubscription, isSimulationMode } from "@/lib/subscription";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/db";

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

    const stripe = getStripe();
    const sub = await getSubscription(user.workspaceId);

    // Resolve the real Stripe customer ID. Simulation-mode IDs (sim_cus_xxx) and
    // missing IDs both trigger an email-based lookup so workspaces that missed the
    // checkout webhook can still access the portal.
    let customerId =
      sub?.stripeCustomerId && !sub.stripeCustomerId.startsWith("sim_")
        ? sub.stripeCustomerId
        : null;

    if (!customerId && user.email) {
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          await prisma.subscription.update({
            where: { workspaceId },
            data: { stripeCustomerId: customerId },
          });
          log.info(
            `[Billing:Portal] resolved stripeCustomerId=${customerId} via email for ws=${workspaceId}`,
          );
        }
      } catch (err) {
        log.error("[Billing:Portal] email-based customer lookup failed", {
          err,
          workspaceId,
        });
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "NO_STRIPE_CUSTOMER" },
        { status: 404 },
      );
    }

    // Derive base URL from the actual request so it works on Vercel regardless
    // of how NEXTAUTH_URL is configured.
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      new URL(req.url).host;
    const baseUrl = `${proto}://${host}`;

    let portalSession: { url: string };
    try {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/einstellungen/abonnement?portal=success`,
      });
    } catch (err) {
      log.error("[Billing:Portal] Stripe portal session creation failed", {
        err,
        workspaceId,
        customerId,
      });
      return NextResponse.json(
        { error: "PORTAL_UNAVAILABLE" },
        { status: 503 },
      );
    }

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
