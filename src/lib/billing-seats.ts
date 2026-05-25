import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";

/**
 * Per-seat billing helpers.
 *
 * Shiftfy bills per active employee on the workspace. Each time an employee
 * is created, deleted, or toggled we mirror that into the Stripe subscription
 * quantity so customers are charged accurately (pay-as-you-grow).
 *
 * Sync model — we never trust the DB seatCount as a stand-in for Stripe's
 * live quantity. Every reconcile fetches the live Stripe subscription, reads
 * the main item's current quantity, and only pushes an update when it differs
 * from the live employee count. This is the only way to heal drift caused
 * by missed webhooks or manual Stripe-side edits.
 */

const MIN_SEATS = 1;

/**
 * Direction of the seat change — determines proration behavior on Stripe.
 *
 *  - "add":       new seat(s); customer is invoiced immediately for the
 *                 prorated remainder of the current cycle.
 *  - "remove":    seat(s) gone; credit is applied to the customer's NEXT
 *                 invoice rather than issuing an immediate credit invoice.
 *  - "reconcile": one-shot integrity sync (admin "Force Sync", backfill).
 *                 Invoices immediately so any back-billing collected.
 */
export type SeatDirection = "add" | "remove" | "reconcile";

export type SeatSyncResult = {
  /** True if a real Stripe call was made (or the DB was already in sync). */
  ok: boolean;
  /** Live Stripe quantity before the call. */
  before: number;
  /** Target quantity after the call. */
  after: number;
  /** True if a change was actually pushed to Stripe. */
  changed: boolean;
  /** Human-readable reason when ok=false. */
  reason?: string;
};

/** Count active employees on a workspace — the source of truth for billing. */
export async function countActiveEmployees(
  workspaceId: string,
): Promise<number> {
  return prisma.employee.count({
    where: { workspaceId, isActive: true },
  });
}

/**
 * Sync the Stripe subscription's main plan item quantity to the given seat
 * count. ALWAYS reads the live Stripe quantity first so we can detect drift
 * (DB cache vs. real Stripe state) and only push when truly needed.
 *
 * Proration:
 *   add | reconcile → "always_invoice" (charge immediately, prorated)
 *   remove          → "create_prorations" (credit on next invoice)
 */
export async function syncSeatQuantityToStripe(
  workspaceId: string,
  newSeatCount: number,
  direction: SeatDirection = "reconcile",
): Promise<SeatSyncResult> {
  const seats = Math.max(MIN_SEATS, Math.floor(newSeatCount));

  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: {
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      seatCount: true,
    },
  });
  if (!sub) {
    return {
      ok: false,
      before: 0,
      after: seats,
      changed: false,
      reason: "NO_SUBSCRIPTION",
    };
  }

  // Sim-mode / no real Stripe IDs: track in DB only, never call Stripe.
  const hasRealStripe =
    sub.stripeSubscriptionId && !sub.stripeSubscriptionId.startsWith("sim_");

  if (!hasRealStripe) {
    if (sub.seatCount !== seats) {
      await prisma.subscription.update({
        where: { workspaceId },
        data: { seatCount: seats },
      });
    }
    return {
      ok: false,
      before: sub.seatCount,
      after: seats,
      changed: false,
      reason: "SIM_MODE",
    };
  }

  try {
    const stripe = getStripe();
    const liveSub = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId!,
      { expand: ["items"] },
    );

    // Find the main plan item — exclude ticketing and schichtplanung addon
    // items (those are billed independently and have fixed quantities).
    const mainItem =
      liveSub.items.data.find(
        (it) =>
          !getTicketingTierByPriceId(it.price.id) &&
          !getSchichtplanungBillingByPriceId(it.price.id),
      ) ?? liveSub.items.data[0];

    if (!mainItem) {
      log.warn("[Billing:Seats] No main item found on subscription", {
        workspaceId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      });
      return {
        ok: false,
        before: sub.seatCount,
        after: seats,
        changed: false,
        reason: "NO_MAIN_ITEM",
      };
    }

    const liveQty = mainItem.quantity ?? MIN_SEATS;

    // No-op if live Stripe quantity already matches target — but heal DB if
    // it drifted from Stripe.
    if (liveQty === seats) {
      if (sub.seatCount !== seats) {
        await prisma.subscription.update({
          where: { workspaceId },
          data: { seatCount: seats },
        });
      }
      return { ok: true, before: liveQty, after: seats, changed: false };
    }

    const prorationBehavior =
      direction === "remove" ? "create_prorations" : "always_invoice";

    await stripe.subscriptions.update(sub.stripeSubscriptionId!, {
      items: [{ id: mainItem.id, quantity: seats }],
      proration_behavior: prorationBehavior,
    });

    // Stripe succeeded — DB update is best-effort; Stripe webhook will heal any drift
    await prisma.subscription
      .update({
        where: { workspaceId },
        data: { seatCount: seats },
      })
      .catch((dbErr) => {
        log.error(
          "[Billing:Seats] Stripe updated but DB seatCount sync failed — will heal on next webhook",
          {
            workspaceId,
            seats,
            dbErr,
          },
        );
      });

    log.info(
      `[Billing:Seats] Synced quantity for ws=${workspaceId}: ${liveQty} → ${seats} (${direction}, ${prorationBehavior})`,
    );
    return { ok: true, before: liveQty, after: seats, changed: true };
  } catch (err) {
    log.error("[Billing:Seats] Stripe quantity sync failed", {
      err,
      workspaceId,
      attemptedSeats: seats,
    });
    return {
      ok: false,
      before: sub.seatCount,
      after: seats,
      changed: false,
      reason: "STRIPE_ERROR",
    };
  }
}

/**
 * Recompute seats from the current employee count and push to Stripe.
 * The single entry point used by employee create/delete handlers — keeps
 * Stripe quantity in lockstep with the DB regardless of which side
 * triggered the change.
 */
export async function reconcileSeatsFromEmployees(
  workspaceId: string,
  direction: SeatDirection = "reconcile",
): Promise<SeatSyncResult> {
  const count = await countActiveEmployees(workspaceId);
  return syncSeatQuantityToStripe(workspaceId, count, direction);
}

/**
 * Read-only drift check — returns the live Stripe quantity and current
 * employee count without making any changes. Used by the admin UI to show
 * whether a Force Sync is needed.
 */
export async function getSeatDrift(workspaceId: string): Promise<{
  employeeCount: number;
  stripeQuantity: number | null;
  inSync: boolean;
  reason?: string;
}> {
  const employeeCount = await countActiveEmployees(workspaceId);

  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { stripeSubscriptionId: true, seatCount: true },
  });
  if (!sub) {
    return {
      employeeCount,
      stripeQuantity: null,
      inSync: true,
      reason: "NO_SUBSCRIPTION",
    };
  }

  const hasRealStripe =
    sub.stripeSubscriptionId && !sub.stripeSubscriptionId.startsWith("sim_");
  if (!hasRealStripe) {
    return {
      employeeCount,
      stripeQuantity: sub.seatCount,
      inSync: sub.seatCount === Math.max(MIN_SEATS, employeeCount),
      reason: "SIM_MODE",
    };
  }

  try {
    const stripe = getStripe();
    const liveSub = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId!,
      { expand: ["items"] },
    );
    const mainItem =
      liveSub.items.data.find(
        (it) =>
          !getTicketingTierByPriceId(it.price.id) &&
          !getSchichtplanungBillingByPriceId(it.price.id),
      ) ?? liveSub.items.data[0];

    const liveQty = mainItem?.quantity ?? MIN_SEATS;
    const expected = Math.max(MIN_SEATS, employeeCount);
    return {
      employeeCount,
      stripeQuantity: liveQty,
      inSync: liveQty === expected,
    };
  } catch (err) {
    log.error("[Billing:Seats] Drift check failed", { err, workspaceId });
    return {
      employeeCount,
      stripeQuantity: null,
      inSync: false,
      reason: "STRIPE_ERROR",
    };
  }
}
