/**
 * Schichtplanung — Shift planning module gating.
 *
 * Schichtplanung is a paid per-user add-on billed on top of the base plan.
 * Enterprise workspaces get it included at no extra charge.
 *
 * Pricing (set via env vars for Stripe test/live flexibility):
 *   Monthly: €1.50 / user / month  (STRIPE_PRICE_SCHICHTPLANUNG_MONTHLY)
 *   Annual:  €14.40 / user / year  (STRIPE_PRICE_SCHICHTPLANUNG_ANNUAL)
 *            ≈ €1.20 / user / month — ~20% savings vs monthly
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/subscription";
import { cache } from "@/lib/cache";

const ADDON_CACHE_TTL = 60; // 1 minute

/* ═══════════════════════════════════════════════════════════════
   Pricing config
   ═══════════════════════════════════════════════════════════════ */

export const SCHICHTPLANUNG_ADDON = {
  perUserMonthlyCents: 150, // €1.50 / user / month
  perUserAnnualCents: 1440, // €14.40 / user / year (€1.20/mo equivalent)
  name: "Schichtplanung",
  stripePriceIdMonthlyEnv: "STRIPE_PRICE_SCHICHTPLANUNG_MONTHLY",
  stripePriceIdAnnualEnv: "STRIPE_PRICE_SCHICHTPLANUNG_ANNUAL",
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
 * - Enterprise: always granted (included in plan)
 * - Basic / Professional: requires the schichtplanung add-on to be active
 */
export async function hasSchichtplanungAddon(
  workspaceId: string,
): Promise<boolean> {
  const cacheKey = `addon:schichtplanung:${workspaceId}`;
  const cached = await cache.get<boolean>(cacheKey);
  if (cached !== null) return cached;

  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { status: true, plan: true, schichtplanungAddonActive: true },
  });

  // TRIALING counts as having the module.
  //
  // The trial exists so a prospect can evaluate the product, and
  // TRIAL_LIMIT_OVERRIDES already unlocks every other paid feature for exactly
  // that reason. It cannot reach this gate, though, because the add-on is not
  // a plan limit -- so a trial user saw no Schichtplanung and no
  // Notfall-Besetzung at all. That is the single module most of them signed up
  // to look at, and the first one they concluded we did not have.
  const result =
    !!sub &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status) &&
    (sub.plan === "ENTERPRISE" ||
      sub.status === "TRIALING" ||
      sub.schichtplanungAddonActive);

  await cache.set(cacheKey, result, ADDON_CACHE_TTL);
  return result;
}

/** Invalidate cached add-on state (call from Stripe webhook on subscription changes). */
export async function invalidateSchichtplanungAddonCache(
  workspaceId: string,
): Promise<void> {
  await cache.del(`addon:schichtplanung:${workspaceId}`);
}

/* ═══════════════════════════════════════════════════════════════
   API guards (return 402 NextResponse or null)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hard guard for write operations on /api/shifts/*.
 * Returns 402 ADDON_REQUIRED when the workspace hasn't subscribed to
 * Schichtplanung (or has no active plan at all).
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
        "Das Schichtplanungs-Modul ist ein kostenpflichtiges Add-on. Bitte aktivieren Sie es in den Abrechnungseinstellungen.",
      addon: "schichtplanung",
      upgradeRequired: true,
      upgradeUrl: "/einstellungen/abonnement?addon=schichtplanung",
    },
    { status: 402 },
  );
}
