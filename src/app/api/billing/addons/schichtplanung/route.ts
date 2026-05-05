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
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import {
  SCHICHTPLANUNG_ADDON,
  getSchichtplanungStripePriceId,
  getSchichtplanungBillingByPriceId,
  type SchichtplanungBilling,
} from "@/lib/schichtplanung-addon";

/**
 * POST /api/billing/addons/schichtplanung
 *
 * Subscribe / change billing cycle / cancel the Schichtplanung add-on for the
 * current workspace.
 *
 * Body:
 *   { active: false }                              → cancel the add-on
 *   { active: true, billing: "monthly" | "annual" } → subscribe / switch cycle
 *
 * Pricing: per-user, charged via Stripe `quantity = subscription.seatCount`
 *   €1.50 / user / month
 *   €14.40 / user / year
 *
 * Enterprise plans get the module for free (no add-on item created); the
 * endpoint short-circuits with a 200 response noting `freeWithPlan: true`.
 *
 * Requires the workspace to already have an active main subscription.
 * In simulation mode (STRIPE_SIMULATION_MODE=true or no Stripe key),
 * updates the local DB only and skips Stripe.
 */
const bodySchema = z.discriminatedUnion("active", [
  z.object({ active: z.literal(false) }),
  z.object({
    active: z.literal(true),
    billing: z.enum(["monthly", "annual"]),
  }),
]);

export const POST = withRoute(
  "/api/billing/addons/schichtplanung",
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
        { error: "Ungültige Eingabe", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

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

    // Enterprise: module is free, no Stripe item needed
    if (subscription.plan === "ENTERPRISE") {
      return NextResponse.json({
        active: true,
        billing: null,
        freeWithPlan: true,
        message: "Schichtplanung ist im Enterprise-Plan enthalten.",
      });
    }

    const newActive = parsed.data.active;
    const newBilling: SchichtplanungBilling | null = parsed.data.active
      ? parsed.data.billing
      : null;

    // No-op when nothing changes
    if (
      subscription.schichtplanungAddonActive === newActive &&
      subscription.schichtplanungAddonBilling === newBilling
    ) {
      return NextResponse.json({
        active: newActive,
        billing: newBilling,
        unchanged: true,
      });
    }

    // ── Simulation mode: DB only ──
    const stripeUnconfigured =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_YOUR");

    if (isSimulationMode() || stripeUnconfigured) {
      await prisma.subscription.update({
        where: { workspaceId },
        data: {
          schichtplanungAddonActive: newActive,
          schichtplanungAddonBilling: newBilling,
          schichtplanungStripeSubscriptionItemId: newActive
            ? `sim_si_schichtplanung_${newBilling}`
            : null,
        },
      });
      log.info(
        `[Billing:Simulate] Schichtplanung add-on → active=${newActive} billing=${newBilling} ws=${workspaceId}`,
      );
      return NextResponse.json({
        active: newActive,
        billing: newBilling,
        simulation: true,
      });
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
            // Persist so future calls skip this lookup.
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
        log.error("[Billing:Addon:Schichtplanung] auto-link failed", {
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
    const quantity = Math.max(1, subscription.seatCount);
    let newItemId: string | null =
      subscription.schichtplanungStripeSubscriptionItemId;

    try {
      if (!newActive) {
        // Cancel
        if (subscription.schichtplanungStripeSubscriptionItemId) {
          await stripe.subscriptionItems.del(
            subscription.schichtplanungStripeSubscriptionItemId,
            { proration_behavior: "create_prorations" },
          );
        }
        newItemId = null;
      } else {
        const priceId = getSchichtplanungStripePriceId(newBilling!);
        if (!priceId) {
          log.error(
            `[Stripe] No price ID configured for schichtplanung billing=${newBilling}`,
          );
          return NextResponse.json(
            {
              error:
                "Schichtplanung-Preis nicht konfiguriert. Bitte Support kontaktieren.",
            },
            { status: 500 },
          );
        }

        if (subscription.schichtplanungStripeSubscriptionItemId) {
          // Switch billing cycle / refresh quantity — prorate at cycle end
          const updated = await stripe.subscriptionItems.update(
            subscription.schichtplanungStripeSubscriptionItemId,
            {
              price: priceId,
              quantity,
              proration_behavior: "create_prorations",
            },
          );
          newItemId = updated.id;
        } else {
          // New add-on: charge immediately, fail fast if payment is incomplete
          const created = await stripe.subscriptionItems.create({
            subscription: stripeSubId,
            price: priceId,
            quantity,
            proration_behavior: "always_invoice",
            payment_behavior: "error_if_incomplete",
          });
          newItemId = created.id;
        }
      }
    } catch (err) {
      log.error("[Stripe] Failed to update schichtplanung add-on item", {
        err,
      });
      return NextResponse.json(
        { error: "Fehler bei der Stripe-Aktualisierung" },
        { status: 502 },
      );
    }

    await prisma.subscription.update({
      where: { workspaceId },
      data: {
        schichtplanungAddonActive: newActive,
        schichtplanungAddonBilling: newBilling,
        schichtplanungStripeSubscriptionItemId: newItemId,
      },
    });

    log.info(
      `[Stripe] Schichtplanung add-on → active=${newActive} billing=${newBilling} ws=${workspaceId} qty=${quantity}`,
    );

    return NextResponse.json({
      active: newActive,
      billing: newBilling,
      stripeSubscriptionItemId: newItemId,
      perUserMonthlyCents: SCHICHTPLANUNG_ADDON.perUserMonthlyCents,
      perUserAnnualCents: SCHICHTPLANUNG_ADDON.perUserAnnualCents,
      seatCount: quantity,
    });
  },
  { idempotent: true },
);
