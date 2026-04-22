/**
 * Schichtplanung — Shift planning module gating.
 *
 * As of the 2026-04 product update, shift planning is INCLUDED in every paid
 * plan (Basic, Professional, Enterprise). The previous per-user add-on pricing
 * has been retired. The pricing constants and Stripe price ID helpers below
 * are kept for backward compatibility with existing webhook + admin-billing
 * routes, but `hasSchichtplanungAddon` now returns true for any workspace with
 * an active subscription.
 */

import { NextResponse } from "next/server";
import { hasActiveSubscription } from "@/lib/subscription";

/* ═══════════════════════════════════════════════════════════════
   Pricing config (DEPRECATED — kept for legacy webhook code paths)
   ═══════════════════════════════════════════════════════════════ */

export const SCHICHTPLANUNG_ADDON = {
  perUserMonthlyCents: 0,
  perUserAnnualCents: 0,
  name: "Schichtplanung",
  stripePriceIdMonthlyEnv: "STRIPE_SCHICHTPLANUNG_MONTHLY_PRICE_ID",
  stripePriceIdAnnualEnv: "STRIPE_SCHICHTPLANUNG_ANNUAL_PRICE_ID",
} as const;

export type SchichtplanungBilling = "monthly" | "annual";

export function getSchichtplanungStripePriceId(
  billing: SchichtplanungBilling,
): string | null {
  const envName =
    billing === "annual"
      ? SCHICHTPLANUNG_ADDON.stripePriceIdAnnualEnv
      : SCHICHTPLANUNG_ADDON.stripePriceIdMonthlyEnv;
  return process.env[envName] ?? null;
}

export function getSchichtplanungBillingByPriceId(
  priceId: string,
): SchichtplanungBilling | null {
  if (process.env[SCHICHTPLANUNG_ADDON.stripePriceIdMonthlyEnv] === priceId)
    return "monthly";
  if (process.env[SCHICHTPLANUNG_ADDON.stripePriceIdAnnualEnv] === priceId)
    return "annual";
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Subscription helpers
   ═══════════════════════════════════════════════════════════════ */

/**
 * True if the workspace has access to the shift planning module.
 * Shift planning is included in all paid plans.
 */
export async function hasSchichtplanungAddon(
  workspaceId: string,
): Promise<boolean> {
  return hasActiveSubscription(workspaceId);
}

/* ═══════════════════════════════════════════════════════════════
   API guards (return 402 NextResponse or null)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hard guard for write operations on /api/shifts/*.
 * Returns 402 only if the workspace has no active subscription at all.
 */
export async function requireSchichtplanungAddon(
  workspaceId: string,
): Promise<NextResponse | null> {
  if (await hasSchichtplanungAddon(workspaceId)) return null;

  return NextResponse.json(
    {
      error: "SUBSCRIPTION_REQUIRED",
      code: "SUBSCRIPTION_REQUIRED",
      message:
        "Für die Schichtplanung ist ein aktives Abonnement erforderlich.",
      upgradeRequired: true,
    },
    { status: 402 },
  );
}
