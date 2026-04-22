/**
 * Schichtplanung Add-On — Per-user shift planning module gating.
 *
 * The Schichtplanung (shift planning) module is a paid add-on for Basic and
 * Professional plans. Enterprise customers always have access for free.
 *
 * Pricing (per active employee seat, billed monthly or yearly):
 *   €1.50 / user / month    (perUserMonthlyCents = 150)
 *   €14.40 / user / year    (perUserAnnualCents  = 1440)
 *
 * The add-on is sold as a separate Stripe Subscription Item attached to the
 * workspace's main subscription. Quantity is synced from Subscription.seatCount.
 *
 * Workspaces without the add-on (Basic/Professional only):
 *   - The /schichtplan page redirects to /einstellungen/abonnement#schichtplanung-addon
 *   - The sidebar shows an "Add-on" badge on the Schichtplan nav item
 *   - Write operations on /api/shifts/* return 402 PAYMENT_REQUIRED
 *   - GET /api/shifts remains open so dashboard widgets and EMPLOYEE shift
 *     visibility (own shifts only) continue to work
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SubscriptionPlan } from "@prisma/client";

/* ═══════════════════════════════════════════════════════════════
   Pricing config
   ═══════════════════════════════════════════════════════════════ */

export const SCHICHTPLANUNG_ADDON = {
  /** Per-user monthly price in EUR cents */
  perUserMonthlyCents: 150,
  /** Per-user annual price in EUR cents (yearly billed) */
  perUserAnnualCents: 1440,
  /** Display name (DE primary market) */
  name: "Schichtplanung Add-on",
  /** Stripe Price ID env vars */
  stripePriceIdMonthlyEnv: "STRIPE_SCHICHTPLANUNG_MONTHLY_PRICE_ID",
  stripePriceIdAnnualEnv: "STRIPE_SCHICHTPLANUNG_ANNUAL_PRICE_ID",
} as const;

export type SchichtplanungBilling = "monthly" | "annual";

/** Resolve the Stripe Price ID for a given billing interval. */
export function getSchichtplanungStripePriceId(
  billing: SchichtplanungBilling,
): string | null {
  const envName =
    billing === "annual"
      ? SCHICHTPLANUNG_ADDON.stripePriceIdAnnualEnv
      : SCHICHTPLANUNG_ADDON.stripePriceIdMonthlyEnv;
  return process.env[envName] ?? null;
}

/** Reverse-lookup: given a Stripe Price ID, return the billing interval if it matches. */
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
 *
 * Access rules:
 *   - ENTERPRISE plan: always true
 *   - BASIC / PROFESSIONAL: only if schichtplanungAddonActive = true
 */
export async function hasSchichtplanungAddon(
  workspaceId: string,
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { plan: true, schichtplanungAddonActive: true },
  });
  if (!sub) return false;
  if (sub.plan === ("ENTERPRISE" satisfies SubscriptionPlan)) return true;
  return sub.schichtplanungAddonActive;
}

/* ═══════════════════════════════════════════════════════════════
   API guards (return 402 NextResponse or null)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hard guard for write operations on /api/shifts/*.
 * Returns 402 if no add-on (and plan is not Enterprise), else null.
 */
export async function requireSchichtplanungAddon(
  workspaceId: string,
): Promise<NextResponse | null> {
  if (await hasSchichtplanungAddon(workspaceId)) return null;

  return NextResponse.json(
    {
      error: "ADDON_REQUIRED",
      code: "SCHICHTPLANUNG_ADDON_REQUIRED",
      message:
        "Die Schichtplanung ist ein kostenpflichtiges Add-on. Bitte aktivieren Sie es in den Abrechnungseinstellungen.",
      addon: "schichtplanung",
      upgradeRequired: true,
    },
    { status: 402 },
  );
}
