/**
 * AI Timesheet Scanner — premium add-on gating.
 *
 * The scanner is free up to a monthly quota; the paid add-on (€24.99/month)
 * raises the quota to a fair-use cap. Mirrors the schichtplanung add-on:
 * a boolean on Subscription + a Stripe subscription-item id, with a cached
 * `hasTimesheetScannerAddon()` check.
 *
 * Pricing (Stripe Price id via env for test/live flexibility):
 *   Monthly: €24.99 / month  (STRIPE_PRICE_TIMESHEET_SCANNER_MONTHLY)
 */

import { prisma } from "@/lib/db";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/subscription";
import { cache } from "@/lib/cache";

const ADDON_CACHE_TTL = 60; // 1 minute

/** Free vs premium monthly scan caps. */
export const FREE_SCANS_PER_MONTH = 30;
export const PREMIUM_SCANS_PER_MONTH = 600;

export const TIMESHEET_SCANNER_ADDON = {
  name: "KI-Stundenzettel-Scanner",
  priceMonthlyCents: 2499, // €24.99 / month
  freeScansPerMonth: FREE_SCANS_PER_MONTH,
  premiumScansPerMonth: PREMIUM_SCANS_PER_MONTH,
  stripePriceIdMonthlyEnv: "STRIPE_PRICE_TIMESHEET_SCANNER_MONTHLY",
} as const;

export type TimesheetScannerBilling = "monthly";

export function getTimesheetScannerStripePriceId(): string | null {
  return process.env[TIMESHEET_SCANNER_ADDON.stripePriceIdMonthlyEnv] ?? null;
}

/** True if `priceId` is the configured timesheet-scanner add-on price. */
export function isTimesheetScannerPriceId(priceId: string): boolean {
  const configured = getTimesheetScannerStripePriceId();
  return !!configured && configured === priceId;
}

/**
 * True if the workspace has the premium scanner add-on active (active
 * subscription + flag). Enterprise plans include it.
 */
export async function hasTimesheetScannerAddon(
  workspaceId: string,
): Promise<boolean> {
  const cacheKey = `addon:timesheet-scanner:${workspaceId}`;
  const cached = await cache.get<boolean>(cacheKey);
  if (cached !== null) return cached;

  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { status: true, plan: true, timesheetScannerAddonActive: true },
  });

  const result =
    !!sub &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status) &&
    (sub.plan === "ENTERPRISE" || sub.timesheetScannerAddonActive);

  await cache.set(cacheKey, result, ADDON_CACHE_TTL);
  return result;
}

/** Invalidate cached add-on state (call from the Stripe webhook on changes). */
export async function invalidateTimesheetScannerAddonCache(
  workspaceId: string,
): Promise<void> {
  await cache.del(`addon:timesheet-scanner:${workspaceId}`);
}
