import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, getPlanByPriceId } from "@/lib/stripe";
import type { PlanId } from "@/lib/stripe";
import {
  activateSubscription,
  updateSubscriptionFromStripe,
  cancelSubscription,
} from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { paymentFailedEmail } from "@/lib/notifications/email-i18n";
import { log } from "@/lib/logger";
import { Redis } from "@upstash/redis";
import { withRoute } from "@/lib/with-route";

/* ── Idempotency guard (Upstash Redis) ──────────────────────────
 * Prevent processing the same Stripe event twice (e.g. on retries).
 * Uses Upstash Redis with a 5-minute TTL so dedup survives Vercel
 * cold-starts and works across multiple serverless instances.
 * Falls back to in-memory Map if Upstash env vars are missing.
 * ─────────────────────────────────────────────────────────────── */
const EVENT_TTL_SECONDS = 5 * 60; // 5 minutes

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

// In-memory fallback for dev/staging without Upstash
const localFallback = new Map<string, number>();

async function isEventProcessed(eventId: string): Promise<boolean> {
  if (redis) {
    const exists = await redis.exists(`stripe_event:${eventId}`);
    return exists === 1;
  }
  // Fallback: in-memory
  const ts = localFallback.get(eventId);
  if (ts && Date.now() - ts < EVENT_TTL_SECONDS * 1000) return true;
  return false;
}

async function markEventProcessed(eventId: string): Promise<void> {
  if (redis) {
    await redis.set(`stripe_event:${eventId}`, "1", {
      ex: EVENT_TTL_SECONDS,
    });
    return;
  }
  // Fallback: in-memory
  localFallback.set(eventId, Date.now());
  if (localFallback.size > 500) {
    const now = Date.now();
    for (const [id, ts] of localFallback) {
      if (now - ts > EVENT_TTL_SECONDS * 1000) localFallback.delete(id);
    }
  }
}

/**
 * POST /api/billing/webhook
 * Stripe webhook handler. Verifies signature then processes events
 * and persists subscription state to the database.
 *
 * Requires env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
export const POST = withRoute("/api/billing/webhook", "POST", async (req) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secret not configured" },
      { status: 501 },
    );
  }

  const stripe = getStripe();
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    log.error("[Stripe] Signature verification failed:", { error: err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (await isEventProcessed(event.id)) {
    log.info(`[Stripe] Skipping duplicate event: ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }
  await markEventProcessed(event.id);

  switch (event.type) {
    /* ─── Checkout completed → activate subscription ─── */
    case "checkout.session.completed": {
      const session = event.data.object;
      const workspaceId = session.client_reference_id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      if (!workspaceId || !subscriptionId || !customerId) {
        log.warn("[Stripe] Missing data in checkout session");
        break;
      }

      // Fetch full subscription details from Stripe
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const item = sub.items.data[0];
      const priceId = item?.price.id;
      const plan = priceId ? getPlanByPriceId(priceId) : undefined;

      await activateSubscription({
        workspaceId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId ?? "",
        plan: (plan?.id ?? "basic") as PlanId,
        seatCount: item?.quantity ?? 1,
        currentPeriodStart: new Date((item?.current_period_start ?? 0) * 1000),
        currentPeriodEnd: new Date((item?.current_period_end ?? 0) * 1000),
        trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        status: sub.status,
      });

      // Sync usage limits to match the new plan
      await syncUsageLimits(workspaceId, (plan?.id ?? "basic") as PlanId);

      log.info(
        `[Stripe] Activated: workspace=${workspaceId} plan=${plan?.id ?? "unknown"}`,
      );
      break;
    }

    /* ─── Subscription updated → sync status ─── */
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const updItem = sub.items.data[0];
      const priceId = updItem?.price.id;

      await updateSubscriptionFromStripe({
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId ?? "",
        status: sub.status,
        seatCount: updItem?.quantity ?? 1,
        currentPeriodStart: new Date(
          (updItem?.current_period_start ?? 0) * 1000,
        ),
        currentPeriodEnd: new Date((updItem?.current_period_end ?? 0) * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });

      // Sync usage limits if the plan changed
      const updatedPlan = priceId ? getPlanByPriceId(priceId) : undefined;
      if (updatedPlan) {
        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { workspaceId: true },
        });
        if (dbSub) {
          await syncUsageLimits(dbSub.workspaceId, updatedPlan.id as PlanId);
        }
      }

      log.info(`[Stripe] Updated: ${sub.id} → ${sub.status}`);
      break;
    }

    /* ─── Subscription deleted → downgrade to free ─── */
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await cancelSubscription(sub.id);
      log.info(`[Stripe] Cancelled: ${sub.id}`);
      break;
    }

    /* ─── Payment failed → notify workspace owner ─── */
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      log.error(`[Stripe] Payment failed: invoice=${invoice.id}`);

      // Find the workspace owner and notify them
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (customerId) {
        try {
          // Two-step lookup to avoid stale Prisma relation-filter types
          const sub = await prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
            select: { workspaceId: true },
          });

          if (sub) {
            const workspace = await prisma.workspace.findUnique({
              where: { id: sub.workspaceId },
              select: { name: true },
            });

            const owner = await prisma.user.findFirst({
              where: { workspaceId: sub.workspaceId, role: "OWNER" },
              select: { email: true, name: true, preferredLocale: true },
            });

            if (owner?.email) {
              const locale = owner.preferredLocale === "en" ? "en" : "de";
              const copy = paymentFailedEmail(
                locale,
                workspace?.name ??
                  (locale === "en" ? "your workspace" : "Ihren Arbeitsbereich"),
              );
              await sendEmail({
                to: owner.email,
                type: "SYSTEM",
                title: copy.subject,
                message: copy.body,
                link: "/einstellungen/abonnement",
                locale,
              });
              log.info(
                `[Stripe] Payment failure notification sent to ${owner.email}`,
              );
            }
          }
        } catch (notifyErr) {
          log.error("[Stripe] Failed to send payment failure notification:", {
            error: notifyErr,
          });
        }
      }
      break;
    }

    default:
      log.info(`[Stripe] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
});
