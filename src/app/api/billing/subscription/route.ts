import { NextResponse } from "next/server";
import {
  getSubscription,
  ensureSubscription,
  isSimulationMode,
  updateSubscriptionFromStripe,
  linkSubscriptionByCustomer,
} from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import { getStripe, getPlanByPriceId, PLANS, type PlanId } from "@/lib/stripe";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";

/**
 * GET /api/billing/subscription
 *
 * Returns the current workspace subscription status and plan limits.
 *
 * If ?reconcile=1 is passed and the workspace has a Stripe subscription,
 * the DB is force-synced with the live Stripe state unconditionally —
 * status, period dates, seatCount, cancelAtPeriodEnd, and plan are all
 * written from live Stripe data. This is the authoritative sync path
 * and runs on every billing page load to keep the UI current without
 * depending solely on webhook delivery.
 */
export const GET = withRoute(
  "/api/billing/subscription",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    let sub = await getSubscription(user.workspaceId);
    if (!sub) sub = await ensureSubscription(user.workspaceId);

    const wantsReconcile =
      new URL(req.url).searchParams.get("reconcile") === "1" &&
      !isSimulationMode() &&
      !!process.env.STRIPE_SECRET_KEY;

    // sim_ IDs were written during simulation mode and don't exist in live Stripe.
    // Treat them as absent so auto-link and reconcile use real Stripe lookups.
    const hasRealSubId =
      !!sub.stripeSubscriptionId &&
      !sub.stripeSubscriptionId.startsWith("sim_");
    const hasRealCustomerId =
      !!sub.stripeCustomerId && !sub.stripeCustomerId.startsWith("sim_");

    // Phase 1 — Auto-link: resolve a missing or sim_ subscription ID.
    // If stripeCustomerId is also sim_/null, fall back to an email-based
    // Stripe customer lookup (handles workspaces that were seeded via
    // simulation mode before live Stripe was connected).
    if (wantsReconcile && !hasRealSubId) {
      try {
        const stripe = getStripe();
        let customerId = hasRealCustomerId ? sub.stripeCustomerId : null;

        if (!customerId && user.email) {
          const customers = await stripe.customers.list({
            email: user.email,
            limit: 1,
          });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
            await prisma.subscription.update({
              where: { workspaceId: user.workspaceId },
              data: { stripeCustomerId: customerId },
            });
            log.info(
              `[Billing] resolved stripeCustomerId=${customerId} via email for ws=${user.workspaceId}`,
            );
          }
        }

        if (customerId) {
          // No status filter — returns all non-canceled subs (active + trialing).
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
                  !getSchichtplanungBillingByPriceId(it.price.id),
              ) ?? liveSub.items.data[0];

            const linked = await linkSubscriptionByCustomer({
              stripeCustomerId: customerId,
              stripeSubscriptionId: liveSub.id,
              stripePriceId: mainItem?.price.id ?? "",
              status: liveSub.status,
              seatCount: mainItem?.quantity ?? sub.seatCount,
              currentPeriodStart: new Date(
                (mainItem?.current_period_start ?? 0) * 1000,
              ),
              currentPeriodEnd: new Date(
                (mainItem?.current_period_end ?? 0) * 1000,
              ),
              cancelAtPeriodEnd: liveSub.cancel_at_period_end,
            });

            if (linked > 0) {
              log.info(
                `[Billing] Auto-linked Stripe subscription ${liveSub.id} to workspace=${user.workspaceId}`,
              );
              const livePlan = mainItem?.price.id
                ? getPlanByPriceId(mainItem.price.id)
                : null;
              if (livePlan) {
                await syncUsageLimits(user.workspaceId, livePlan.id as PlanId);
              }
              sub = (await getSubscription(user.workspaceId))!;
            }
          }
        }
      } catch (err) {
        log.error("[Billing] auto-link subscription failed", {
          error: err instanceof Error ? err.message : String(err),
          workspaceId: user.workspaceId,
        });
      }
    }

    // Recompute after possible auto-link above.
    const resolvedSubId =
      sub.stripeSubscriptionId && !sub.stripeSubscriptionId.startsWith("sim_")
        ? sub.stripeSubscriptionId
        : null;

    const shouldReconcile = wantsReconcile && !!resolvedSubId;

    if (shouldReconcile && resolvedSubId) {
      try {
        const stripe = getStripe();
        const liveSub = await stripe.subscriptions.retrieve(resolvedSubId);

        // Find the main plan item — exclude ticketing and schichtplanung addon items.
        // Falls back to first item if no plan item is identifiable (e.g. env vars
        // not yet configured), which is still better than using a stale DB value.
        const mainItem =
          liveSub.items.data.find(
            (it) =>
              !getTicketingTierByPriceId(it.price.id) &&
              !getSchichtplanungBillingByPriceId(it.price.id),
          ) ?? liveSub.items.data[0];

        const livePriceId = mainItem?.price.id ?? "";
        const livePlan = livePriceId ? getPlanByPriceId(livePriceId) : null;

        if (!livePlan && livePriceId) {
          log.warn(
            "[Billing] reconcile: live priceId not found in PLANS config — plan field will not be updated. Check STRIPE_PRICE_* env vars.",
            { workspaceId: user.workspaceId, livePriceId },
          );
        }

        // Always sync all fields unconditionally — period dates, status,
        // seatCount, and cancelAtPeriodEnd change without plan changes
        // (e.g. on invoice renewal, payment method updates, etc.).
        await updateSubscriptionFromStripe({
          stripeSubscriptionId: resolvedSubId,
          stripePriceId: livePriceId,
          status: liveSub.status,
          seatCount: mainItem?.quantity ?? sub.seatCount,
          currentPeriodStart: new Date(
            (mainItem?.current_period_start ?? 0) * 1000,
          ),
          currentPeriodEnd: new Date(
            (mainItem?.current_period_end ?? 0) * 1000,
          ),
          cancelAtPeriodEnd: liveSub.cancel_at_period_end,
        });

        if (livePlan) {
          await syncUsageLimits(user.workspaceId, livePlan.id as PlanId);
        }

        sub = await getSubscription(user.workspaceId);
      } catch (err) {
        log.error("[Billing] reconcile failed", {
          error: err instanceof Error ? err.message : String(err),
          workspaceId: user.workspaceId,
        });
      }
    }

    if (!sub) sub = await ensureSubscription(user.workspaceId);

    const planId = sub.plan.toLowerCase() as PlanId;
    const planConfig = PLANS[planId];

    // Detect the billing cycle from the stored price ID so the UI can
    // pre-select the correct toggle instead of always defaulting to annual.
    const annualPriceIds = [
      process.env.STRIPE_PRICE_BASIC_ANNUAL,
      process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
    ].filter(Boolean);
    const detectedCycle: "monthly" | "annual" =
      sub.stripePriceId && annualPriceIds.includes(sub.stripePriceId)
        ? "annual"
        : sub.stripePriceId
          ? "monthly"
          : "annual"; // default when no price ID (trial / sim)

    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      seatCount: sub.seatCount,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      trialEnd: sub.trialEnd,
      hasStripeSubscription: !!resolvedSubId,
      billingCycle: detectedCycle,
      ticketingTier: sub.ticketingTier ?? "NONE",
      schichtplanungAddonActive: sub.schichtplanungAddonActive,
      schichtplanungAddonBilling: sub.schichtplanungAddonBilling,
      limits: planConfig?.limits ?? PLANS.basic.limits,
      simulationMode:
        isSimulationMode() ||
        !!sub.stripeSubscriptionId?.startsWith("sim_") ||
        !!sub.stripeCustomerId?.startsWith("sim_"),
      reconciled: shouldReconcile,
    });
  },
);
