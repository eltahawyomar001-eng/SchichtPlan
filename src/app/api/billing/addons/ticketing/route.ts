import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { isSimulationMode } from "@/lib/subscription";
import { log } from "@/lib/logger";
import {
  TICKETING_ADDON,
  getTicketingStripePriceId,
  syncTicketingLimits,
} from "@/lib/ticketing-addon";
import { TicketingAddonTier } from "@prisma/client";

/**
 * POST /api/billing/addons/ticketing
 *
 * Subscribe / change tier / cancel the Ticketing add-on for the current workspace.
 *
 * Body: { tier: "STARTER" | "GROWTH" | "BUSINESS" | "NONE" }
 *
 *   NONE     → cancel the add-on (removes the Stripe subscription item)
 *   STARTER  → €18.99/mo, 200 tickets/mo, 5 GB storage
 *   GROWTH   → €33.99/mo, 500 tickets/mo, 15 GB storage
 *   BUSINESS → €55.99/mo, 1000 tickets/mo, 40 GB storage
 *
 * Requires the workspace to already have an active main subscription.
 * In simulation mode (STRIPE_SIMULATION_MODE=true or no Stripe key),
 * updates the local DB only and skips Stripe.
 */
const bodySchema = z.object({
  tier: z.enum(["NONE", "STARTER", "GROWTH", "BUSINESS"]),
});

export const POST = withRoute(
  "/api/billing/addons/ticketing",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tier value", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const newTier = parsed.data.tier as TicketingAddonTier;

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "Kein aktives Abonnement gefunden. Bitte zuerst einen Plan wählen.",
        },
        { status: 400 },
      );
    }

    const currentTier = subscription.ticketingTier;
    if (currentTier === newTier) {
      return NextResponse.json({ tier: currentTier, unchanged: true });
    }

    // ── Simulation mode: DB only ──
    const stripeUnconfigured =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_YOUR");

    if (
      isSimulationMode() ||
      stripeUnconfigured ||
      !subscription.stripeSubscriptionId
    ) {
      await prisma.subscription.update({
        where: { workspaceId },
        data: {
          ticketingTier: newTier,
          ticketingStripeSubscriptionItemId:
            newTier === "NONE" ? null : `sim_si_ticketing_${newTier}`,
        },
      });
      await syncTicketingLimits(workspaceId, newTier);
      log.info(
        `[Billing:Simulate] Ticketing add-on ${currentTier} → ${newTier} for workspace=${workspaceId}`,
      );
      return NextResponse.json({ tier: newTier, simulation: true });
    }

    // ── Real Stripe: manage subscription item ──
    const stripe = getStripe();
    const stripeSubId = subscription.stripeSubscriptionId;
    let newItemId: string | null =
      subscription.ticketingStripeSubscriptionItemId;

    try {
      if (newTier === "NONE") {
        // Cancel the add-on item
        if (subscription.ticketingStripeSubscriptionItemId) {
          await stripe.subscriptionItems.del(
            subscription.ticketingStripeSubscriptionItemId,
            { proration_behavior: "create_prorations" },
          );
        }
        newItemId = null;
      } else {
        const priceId = getTicketingStripePriceId(newTier);
        if (!priceId) {
          log.error(
            `[Stripe] No price ID configured for ticketing tier ${newTier}`,
          );
          return NextResponse.json(
            {
              error:
                "Ticketing-Tier-Preis nicht konfiguriert. Bitte Support kontaktieren.",
            },
            { status: 500 },
          );
        }

        if (subscription.ticketingStripeSubscriptionItemId) {
          // Upgrade/downgrade existing item with proration
          const updated = await stripe.subscriptionItems.update(
            subscription.ticketingStripeSubscriptionItemId,
            { price: priceId, proration_behavior: "create_prorations" },
          );
          newItemId = updated.id;
        } else {
          // Add new add-on item to existing subscription
          const created = await stripe.subscriptionItems.create({
            subscription: stripeSubId,
            price: priceId,
            quantity: 1,
            proration_behavior: "create_prorations",
          });
          newItemId = created.id;
        }
      }
    } catch (err) {
      log.error("[Stripe] Failed to update ticketing add-on item", { err });
      return NextResponse.json(
        { error: "Fehler bei der Stripe-Aktualisierung" },
        { status: 502 },
      );
    }

    await prisma.subscription.update({
      where: { workspaceId },
      data: {
        ticketingTier: newTier,
        ticketingStripeSubscriptionItemId: newItemId,
      },
    });
    await syncTicketingLimits(workspaceId, newTier);

    log.info(
      `[Stripe] Ticketing add-on ${currentTier} → ${newTier} for workspace=${workspaceId}`,
    );

    return NextResponse.json({
      tier: newTier,
      stripeSubscriptionItemId: newItemId,
      tierConfig: newTier === "NONE" ? null : TICKETING_ADDON[newTier],
    });
  },
  { idempotent: true },
);
