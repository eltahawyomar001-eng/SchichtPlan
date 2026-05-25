import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
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

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = bodySchema.safeParse(_json.data);
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
    // Simulation IDs (sim_sub_xxx) don't exist in live Stripe — treat as absent
    // so the auto-link fallback below can resolve the real subscription.
    if (stripeSubId?.startsWith("sim_")) stripeSubId = null;

    // Auto-link fallback: webhook may have been missed during checkout.
    // Resolves stripeSubscriptionId from Stripe if it is null in DB.
    if (!stripeSubId) {
      try {
        // Step 1: prefer lookup by stripeCustomerId already in DB.
        // Step 2: if no customerId (or it's a sim_ placeholder), search Stripe by
        //         the user's email (handles accounts seeded in simulation mode).
        let customerId = subscription.stripeCustomerId?.startsWith("sim_")
          ? null
          : subscription.stripeCustomerId;
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
        // Cancel — tolerate items Stripe already removed (webhook race).
        if (subscription.schichtplanungStripeSubscriptionItemId) {
          try {
            await stripe.subscriptionItems.del(
              subscription.schichtplanungStripeSubscriptionItemId,
              { proration_behavior: "create_prorations" },
            );
          } catch (delErr) {
            const code = (delErr as { code?: string })?.code;
            if (code !== "resource_missing") throw delErr;
            log.warn(
              "[Stripe] Schichtplanung item already gone in Stripe, treating as canceled",
              {
                itemId: subscription.schichtplanungStripeSubscriptionItemId,
              },
            );
          }
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
              error: "PRICE_NOT_CONFIGURED",
              message:
                "Schichtplanung-Preis nicht konfiguriert. Bitte Support kontaktieren.",
            },
            { status: 500 },
          );
        }

        // If we *think* there's an item but Stripe lost it, fall back to create.
        let existingItemId =
          subscription.schichtplanungStripeSubscriptionItemId;
        if (existingItemId) {
          try {
            await stripe.subscriptionItems.retrieve(existingItemId);
          } catch (lookupErr) {
            const code = (lookupErr as { code?: string })?.code;
            if (code === "resource_missing") {
              log.warn(
                "[Stripe] DB references stale schichtplanung item, will recreate",
                { staleId: existingItemId, workspaceId },
              );
              existingItemId = null;
            }
          }
        }

        // Monthly-normalised cents to determine proration direction.
        // Annual pricing is cheaper per month — switching annual→monthly is
        // an effective upgrade (higher monthly cost) so charge immediately.
        const toMonthlyCents = (billing: string | null) =>
          billing === "annual"
            ? Math.round(SCHICHTPLANUNG_ADDON.perUserAnnualCents / 12)
            : SCHICHTPLANUNG_ADDON.perUserMonthlyCents;
        const currentMonthlyCents = toMonthlyCents(
          subscription.schichtplanungAddonBilling,
        );
        const newMonthlyCents = toMonthlyCents(newBilling);
        const schichtProration =
          newMonthlyCents > currentMonthlyCents
            ? "always_invoice"
            : "create_prorations";

        const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));

        if (existingItemId) {
          const updated = await stripe.subscriptionItems.update(
            existingItemId,
            {
              price: priceId,
              quantity,
              proration_behavior: schichtProration,
            },
            {
              idempotencyKey: `schichtplanung-update:${workspaceId}:${newBilling}:${dayBucket}`,
            },
          );
          newItemId = updated.id;
        } else {
          const created = await stripe.subscriptionItems.create(
            {
              subscription: stripeSubId,
              price: priceId,
              quantity,
              proration_behavior: "always_invoice",
              payment_behavior: "error_if_incomplete",
            },
            {
              idempotencyKey: `schichtplanung-create:${workspaceId}:${newBilling}:${dayBucket}`,
            },
          );
          newItemId = created.id;
        }
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const declineCode = (err as { decline_code?: string })?.decline_code;
      log.error("[Stripe] Failed to update schichtplanung add-on item", {
        err,
        code,
        declineCode,
        workspaceId,
      });
      if (
        code === "subscription_payment_intent_requires_action" ||
        code === "card_declined" ||
        code === "missing" ||
        declineCode
      ) {
        return NextResponse.json(
          {
            error: "PAYMENT_REQUIRED",
            message:
              "Zahlung konnte nicht verarbeitet werden. Bitte Zahlungsmethode im Kundenportal aktualisieren.",
          },
          { status: 402 },
        );
      }
      return NextResponse.json(
        {
          error: "STRIPE_UPDATE_FAILED",
          message: "Fehler bei der Stripe-Aktualisierung",
        },
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
