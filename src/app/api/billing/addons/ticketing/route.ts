import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  isSimulationMode,
  linkSubscriptionByCustomer,
} from "@/lib/subscription";
import { log } from "@/lib/logger";
import {
  TICKETING_ADDON,
  getTicketingStripePriceId,
  getTicketingTierByPriceId,
  syncTicketingLimits,
} from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
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

    if (isSimulationMode() || stripeUnconfigured) {
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
    let stripeSubId = subscription.stripeSubscriptionId;

    // Auto-link fallback: webhook may have been missed during checkout.
    // Resolves stripeSubscriptionId from Stripe if it is null in DB.
    if (!stripeSubId) {
      try {
        // Step 1: prefer lookup by stripeCustomerId already in DB.
        // Step 2: if no customerId, search Stripe by the user's email (handles
        //         accounts that were seeded via simulation mode and switched to live).
        let customerId = subscription.stripeCustomerId;
        if (!customerId && user.email) {
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
              `[Billing:Addon] resolved stripeCustomerId=${customerId} via email for ws=${workspaceId}`,
            );
          }
        }

        if (customerId) {
          // No status filter — Stripe returns all non-canceled subs by default
          // (active AND trialing both grant dashboard access).
          const stripeSubs = await stripe.subscriptions.list({
            customer: customerId,
            limit: 5,
            expand: ["data.items"],
          });
          // Prefer active, then trialing, then any other non-canceled status.
          stripeSubs.data.sort((a, b) => {
            const rank = (s: string) =>
              s === "active" ? 0 : s === "trialing" ? 1 : 2;
            return rank(a.status) - rank(b.status);
          });
          if (stripeSubs.data.length > 0) {
            const liveSub = stripeSubs.data[0];
            const mainItem =
              liveSub.items.data.find(
                (it) =>
                  !getTicketingTierByPriceId(it.price.id) &&
                  !getSchichtplanungBillingByPriceId(it.price.id),
              ) ?? liveSub.items.data[0];
            const linked = await linkSubscriptionByCustomer({
              stripeCustomerId: customerId,
              stripeSubscriptionId: liveSub.id,
              stripePriceId: mainItem?.price.id ?? "",
              status: liveSub.status,
              seatCount: mainItem?.quantity ?? subscription.seatCount,
              currentPeriodStart: new Date(
                (mainItem?.current_period_start ?? 0) * 1000,
              ),
              currentPeriodEnd: new Date(
                (mainItem?.current_period_end ?? 0) * 1000,
              ),
              cancelAtPeriodEnd: liveSub.cancel_at_period_end,
            });
            if (linked > 0) {
              stripeSubId = liveSub.id;
              log.info(
                `[Billing:Addon] auto-linked stripeSubscriptionId=${liveSub.id} for ws=${workspaceId}`,
              );
            }
          }
        }
      } catch (err) {
        log.error("[Billing:Addon:Ticketing] auto-link failed", {
          err,
          workspaceId,
        });
      }
    }

    if (!stripeSubId) {
      return NextResponse.json(
        {
          error: "NO_BASE_SUBSCRIPTION",
          message:
            "Bitte schließen Sie zuerst ein Basisabonnement ab, bevor Sie Add-ons hinzufügen.",
        },
        { status: 400 },
      );
    }
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
