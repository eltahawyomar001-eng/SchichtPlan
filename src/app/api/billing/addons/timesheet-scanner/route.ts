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
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
import {
  TIMESHEET_SCANNER_ADDON,
  PREMIUM_SCANS_PER_MONTH,
  FREE_SCANS_PER_MONTH,
  getTimesheetScannerStripePriceId,
  isTimesheetScannerPriceId,
  invalidateTimesheetScannerAddonCache,
} from "@/lib/timesheet-scanner-addon";

/**
 * POST /api/billing/addons/timesheet-scanner
 *
 * Subscribe / cancel the AI Timesheet Scanner add-on for the current
 * workspace. Unlike the per-user Schichtplanung add-on this is a flat
 * monthly fee (€24.99) that raises the scan quota from 30 → 600/month,
 * so the Stripe line always has quantity = 1 and billing is monthly only.
 *
 * Body:
 *   { active: false } → cancel the add-on
 *   { active: true }  → subscribe
 *
 * Enterprise plans include the premium quota for free (no Stripe item).
 * Requires an active main subscription. In simulation mode the DB is
 * updated and Stripe is skipped.
 */
const bodySchema = z.object({ active: z.boolean() });

export const POST = withRoute(
  "/api/billing/addons/timesheet-scanner",
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

    // Enterprise: premium quota is free, no Stripe item needed.
    if (subscription.plan === "ENTERPRISE") {
      return NextResponse.json({
        active: true,
        freeWithPlan: true,
        message:
          "Der KI-Stundenzettel-Scanner ist im Enterprise-Plan enthalten.",
      });
    }

    const newActive = parsed.data.active;

    // No-op when nothing changes.
    if (subscription.timesheetScannerAddonActive === newActive) {
      return NextResponse.json({ active: newActive, unchanged: true });
    }

    const newLimit = newActive ? PREMIUM_SCANS_PER_MONTH : FREE_SCANS_PER_MONTH;

    /** Persist DB state + sync the displayed scan limit + drop the cache. */
    const persist = async (itemId: string | null) => {
      await prisma.subscription.update({
        where: { workspaceId },
        data: {
          timesheetScannerAddonActive: newActive,
          timesheetScannerAddonBilling: newActive ? "monthly" : null,
          timesheetScannerStripeSubscriptionItemId: itemId,
        },
      });
      await prisma.workspaceUsage
        .updateMany({
          where: { workspaceId },
          data: { scansMonthlyLimit: newLimit },
        })
        .catch(() => {});
      await invalidateTimesheetScannerAddonCache(workspaceId).catch(() => {});
    };

    // ── Simulation mode: DB only ──
    const stripeUnconfigured =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_YOUR");

    if (isSimulationMode() || stripeUnconfigured) {
      await persist(newActive ? "sim_si_timesheet_scanner" : null);
      log.info(
        `[Billing:Simulate] Timesheet-scanner add-on → active=${newActive} ws=${workspaceId}`,
      );
      return NextResponse.json({ active: newActive, simulation: true });
    }

    // ── Real Stripe: manage subscription item ──
    const stripe = getStripe();
    let stripeSubId = subscription.stripeSubscriptionId;
    // Simulation IDs (sim_sub_xxx) don't exist in live Stripe — treat as absent
    // so the auto-link fallback below can resolve the real subscription.
    if (stripeSubId?.startsWith("sim_")) stripeSubId = null;

    // Auto-link fallback: a missed checkout webhook can leave
    // stripeSubscriptionId null. Resolve it from Stripe by customer/email.
    if (!stripeSubId) {
      try {
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
          const stripeSubs = await stripe.subscriptions.list({
            customer: customerId,
            limit: 5,
            expand: ["data.items"],
          });
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
                  !getSchichtplanungBillingByPriceId(it.price.id) &&
                  !isTimesheetScannerPriceId(it.price.id),
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
        log.error("[Billing:Addon:TimesheetScanner] auto-link failed", {
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
      subscription.timesheetScannerStripeSubscriptionItemId;
    const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));

    try {
      if (!newActive) {
        // Cancel — tolerate items Stripe already removed (webhook race).
        if (subscription.timesheetScannerStripeSubscriptionItemId) {
          try {
            await stripe.subscriptionItems.del(
              subscription.timesheetScannerStripeSubscriptionItemId,
              { proration_behavior: "create_prorations" },
            );
          } catch (delErr) {
            const code = (delErr as { code?: string })?.code;
            if (code !== "resource_missing") throw delErr;
            log.warn(
              "[Stripe] Timesheet-scanner item already gone in Stripe, treating as canceled",
              {
                itemId: subscription.timesheetScannerStripeSubscriptionItemId,
              },
            );
          }
        }
        newItemId = null;
      } else {
        const priceId = getTimesheetScannerStripePriceId();
        if (!priceId) {
          log.error("[Stripe] No price ID configured for timesheet-scanner");
          return NextResponse.json(
            {
              error: "PRICE_NOT_CONFIGURED",
              message:
                "Scanner-Preis nicht konfiguriert. Bitte Support kontaktieren.",
            },
            { status: 500 },
          );
        }

        // If we *think* there's an item but Stripe lost it, fall back to create.
        let existingItemId =
          subscription.timesheetScannerStripeSubscriptionItemId;
        if (existingItemId) {
          try {
            await stripe.subscriptionItems.retrieve(existingItemId);
          } catch (lookupErr) {
            const code = (lookupErr as { code?: string })?.code;
            if (code === "resource_missing") {
              log.warn(
                "[Stripe] DB references stale timesheet-scanner item, will recreate",
                { staleId: existingItemId, workspaceId },
              );
              existingItemId = null;
            }
          }
        }

        if (existingItemId) {
          const updated = await stripe.subscriptionItems.update(
            existingItemId,
            { price: priceId, quantity: 1 },
            {
              idempotencyKey: `timesheet-scanner-update:${workspaceId}:${dayBucket}`,
            },
          );
          newItemId = updated.id;
        } else {
          const created = await stripe.subscriptionItems.create(
            {
              subscription: stripeSubId,
              price: priceId,
              quantity: 1,
              proration_behavior: "always_invoice",
              payment_behavior: "error_if_incomplete",
            },
            {
              idempotencyKey: `timesheet-scanner-create:${workspaceId}:${dayBucket}`,
            },
          );
          newItemId = created.id;
        }
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const declineCode = (err as { decline_code?: string })?.decline_code;
      log.error("[Stripe] Failed to update timesheet-scanner add-on item", {
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

    await persist(newItemId);

    log.info(
      `[Stripe] Timesheet-scanner add-on → active=${newActive} ws=${workspaceId}`,
    );

    return NextResponse.json({
      active: newActive,
      stripeSubscriptionItemId: newItemId,
      priceMonthlyCents: TIMESHEET_SCANNER_ADDON.priceMonthlyCents,
    });
  },
  { idempotent: true },
);
