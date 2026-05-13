import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { getTicketingTierByPriceId } from "@/lib/ticketing-addon";
import { getSchichtplanungBillingByPriceId } from "@/lib/schichtplanung-addon";

/**
 * Per-seat billing helpers.
 *
 * Shiftfy bills per active employee on the workspace. Each time an employee
 * is created or deleted we mirror that into the Stripe subscription quantity
 * so customers are charged accurately (pay-as-you-grow). All calls fail
 * silently for sim-mode / unconfigured workspaces — billing should never
 * block employee CRUD.
 */

const MIN_SEATS = 1;

/** Count active employees on a workspace — the source of truth for billing. */
export async function countActiveEmployees(
  workspaceId: string,
): Promise<number> {
  return prisma.employee.count({
    where: { workspaceId, isActive: true },
  });
}

/**
 * Sync the Stripe subscription's main plan item quantity to match the given
 * seat count. Pro-rates the difference and invoices immediately so that the
 * customer is charged the fractional remaining-month cost for new seats
 * (and credited for removed seats). DB seatCount is updated to match.
 *
 * Returns true on success, false if the workspace isn't billable (sim mode,
 * missing Stripe IDs, addon-only subscription, etc.).
 */
export async function syncSeatQuantityToStripe(
  workspaceId: string,
  newSeatCount: number,
): Promise<boolean> {
  const seats = Math.max(MIN_SEATS, Math.floor(newSeatCount));

  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: {
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      seatCount: true,
    },
  });
  if (!sub) return false;

  // Sim-mode / no real Stripe IDs: just track in DB, never call Stripe.
  const hasRealStripe =
    sub.stripeSubscriptionId && !sub.stripeSubscriptionId.startsWith("sim_");

  if (!hasRealStripe) {
    if (sub.seatCount !== seats) {
      await prisma.subscription.update({
        where: { workspaceId },
        data: { seatCount: seats },
      });
    }
    return false;
  }

  // No-op if quantity hasn't changed.
  if (sub.seatCount === seats) return true;

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
      return false;
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId!, {
      items: [{ id: mainItem.id, quantity: seats }],
      proration_behavior: "always_invoice",
    });

    await prisma.subscription.update({
      where: { workspaceId },
      data: { seatCount: seats },
    });

    log.info(
      `[Billing:Seats] Synced quantity for ws=${workspaceId}: ${sub.seatCount} → ${seats}`,
    );
    return true;
  } catch (err) {
    log.error("[Billing:Seats] Stripe quantity sync failed", {
      err,
      workspaceId,
      attemptedSeats: seats,
    });
    return false;
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
): Promise<void> {
  const count = await countActiveEmployees(workspaceId);
  await syncSeatQuantityToStripe(workspaceId, count);
}
