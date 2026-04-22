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
  SCHICHTPLANUNG_ADDON,
  getSchichtplanungStripePriceId,
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

    if (
      isSimulationMode() ||
      stripeUnconfigured ||
      !subscription.stripeSubscriptionId
    ) {
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
    const stripeSubId = subscription.stripeSubscriptionId;
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
          // Switch billing cycle / refresh quantity
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
          // New subscription item
          const created = await stripe.subscriptionItems.create({
            subscription: stripeSubId,
            price: priceId,
            quantity,
            proration_behavior: "create_prorations",
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
