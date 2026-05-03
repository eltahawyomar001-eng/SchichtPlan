import { NextResponse } from "next/server";
import { PLANS, PLAN_ORDER } from "@/lib/stripe";
import { TICKETING_ADDON } from "@/lib/ticketing-addon";
import { SCHICHTPLANUNG_ADDON } from "@/lib/schichtplanung-addon";

/**
 * GET /api/public/plans
 *
 * Public endpoint (no auth required) that returns plan pricing and feature
 * data. Stripe price IDs and env-specific details are intentionally omitted.
 * Used by the pricing page and the billing settings page so that displayed
 * prices always match the server-side PLANS source of truth.
 */
export const GET = async () => {
  const plans = PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    return {
      id: p.id,
      name: p.name,
      perUserMonthlyCents: p.perUserMonthly,
      perUserAnnualCents: p.perUserAnnual,
      limits: p.limits,
    };
  });

  const ticketingTiers = (
    Object.keys(TICKETING_ADDON) as Array<keyof typeof TICKETING_ADDON>
  ).map((tier) => ({
    id: tier,
    name: TICKETING_ADDON[tier].name,
    priceMonthlyCents: TICKETING_ADDON[tier].priceMonthlyCents,
    ticketsPerMonth: TICKETING_ADDON[tier].ticketsPerMonth,
    storageGb: TICKETING_ADDON[tier].storageGb,
  }));

  const schichtplanung = {
    perUserMonthlyCents: SCHICHTPLANUNG_ADDON.perUserMonthlyCents,
    perUserAnnualCents: SCHICHTPLANUNG_ADDON.perUserAnnualCents,
    name: SCHICHTPLANUNG_ADDON.name,
  };

  return NextResponse.json({ plans, ticketingTiers, schichtplanung });
};
