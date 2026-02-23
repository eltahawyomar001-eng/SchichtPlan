import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, getPlanByPriceId } from "@/lib/stripe";
import type { PlanId } from "@/lib/stripe";
import {
  activateSubscription,
  updateSubscriptionFromStripe,
  cancelSubscription,
} from "@/lib/subscription";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { log } from "@/lib/logger";

/* ── Idempotency guard ──────────────────────────────────────────
 * Prevent processing the same Stripe event twice (e.g. on retries).
 * We use a simple in-memory Map with TTL. For multi-instance
 * deployments, replace with a DB-backed check or Redis.
 * ─────────────────────────────────────────────────────────────── */
const PROCESSED_EVENTS = new Map<string, number>();
const EVENT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isEventProcessed(eventId: string): boolean {
  const ts = PROCESSED_EVENTS.get(eventId);
  if (ts && Date.now() - ts < EVENT_TTL_MS) return true;
  return false;
}

function markEventProcessed(eventId: string): void {
  PROCESSED_EVENTS.set(eventId, Date.now());
  // Cleanup old entries
  if (PROCESSED_EVENTS.size > 500) {
    const now = Date.now();
    for (const [id, ts] of PROCESSED_EVENTS) {
      if (now - ts > EVENT_TTL_MS) PROCESSED_EVENTS.delete(id);
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
export async function POST(req: Request) {
  try {
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

    // ── Idempotency: skip already-processed events ──
    if (isEventProcessed(event.id)) {
      log.info(`[Stripe] Skipping duplicate event: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    markEventProcessed(event.id);

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
          plan: (plan?.id ?? "team") as PlanId,
          seatCount: item?.quantity ?? 1,
          currentPeriodStart: new Date(
            (item?.current_period_start ?? 0) * 1000,
          ),
          currentPeriodEnd: new Date((item?.current_period_end ?? 0) * 1000),
          trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          status: sub.status,
        });

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
                select: { email: true, name: true },
              });

              if (owner?.email) {
                await sendEmail({
                  to: owner.email,
                  type: "SYSTEM",
                  title: "Zahlung fehlgeschlagen – Aktion erforderlich",
                  message:
                    `Ihre letzte Zahlung für "${workspace?.name ?? "Ihren Arbeitsbereich"}" ` +
                    `konnte nicht verarbeitet werden. ` +
                    `Bitte aktualisieren Sie Ihre Zahlungsmethode in den Einstellungen, ` +
                    `um eine Unterbrechung Ihres Abonnements zu vermeiden.`,
                  link: "/einstellungen/abonnement",
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
  } catch (error) {
    log.error("[Stripe] Webhook error:", { error: error });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
