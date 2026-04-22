/**
 * Ticketing Add-On — Tier configuration & quota guards.
 *
 * The Ticketing System is a paid add-on (separate from the main BASIC/PROFESSIONAL/ENTERPRISE plans).
 * It is sold as a separate Stripe Subscription Item attached to the workspace's main subscription.
 *
 * Three tiers (see TICKETING_ADDON below):
 *   STARTER   €18.99 /mo  → 200 tickets/mo,   5 GB attachment storage
 *   GROWTH    €33.99 /mo  → 500 tickets/mo,  15 GB attachment storage
 *   BUSINESS  €55.99 /mo  → 1000 tickets/mo, 40 GB attachment storage
 *
 * Workspaces without the add-on see the ticketing nav with an "Add-on" badge,
 * pages redirect to /einstellungen/abrechnung#ticketing-addon, and
 * /api/tickets endpoints return 402 PAYMENT_REQUIRED.
 *
 * Limits are enforced via WorkspaceUsage (ticketsCreatedThisMonth, ticketStorageBytesUsed).
 * The monthly counter resets via the Stripe webhook on `invoice.paid` for the add-on item,
 * or via the cron in /api/cron/reset-ticket-quotas as a safety net.
 */

import { NextResponse } from "next/server";
import { TicketingAddonTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   Tier configuration
   ═══════════════════════════════════════════════════════════════ */

export interface TicketingTierConfig {
  id: TicketingAddonTier;
  /** Display name (DE primary market) */
  name: string;
  /** Monthly price in EUR cents */
  priceMonthlyCents: number;
  /** Max tickets per billing period */
  ticketsPerMonth: number;
  /** Max attachment storage in bytes */
  storageBytes: bigint;
  /** Max attachment storage in human-readable GB (for display) */
  storageGb: number;
  /** Stripe Price ID env var name */
  stripePriceIdEnv: string;
}

const GB = BigInt(1024) * BigInt(1024) * BigInt(1024);

export const TICKETING_ADDON: Record<
  Exclude<TicketingAddonTier, "NONE">,
  TicketingTierConfig
> = {
  STARTER: {
    id: "STARTER",
    name: "Ticketing Starter",
    priceMonthlyCents: 1899,
    ticketsPerMonth: 200,
    storageBytes: BigInt(5) * GB,
    storageGb: 5,
    stripePriceIdEnv: "STRIPE_TICKETING_STARTER_PRICE_ID",
  },
  GROWTH: {
    id: "GROWTH",
    name: "Ticketing Growth",
    priceMonthlyCents: 3399,
    ticketsPerMonth: 500,
    storageBytes: BigInt(15) * GB,
    storageGb: 15,
    stripePriceIdEnv: "STRIPE_TICKETING_GROWTH_PRICE_ID",
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Ticketing Business",
    priceMonthlyCents: 5599,
    ticketsPerMonth: 1000,
    storageBytes: BigInt(40) * GB,
    storageGb: 40,
    stripePriceIdEnv: "STRIPE_TICKETING_BUSINESS_PRICE_ID",
  },
};

/** Resolve a tier's Stripe Price ID at runtime (test/live env-driven). */
export function getTicketingStripePriceId(
  tier: Exclude<TicketingAddonTier, "NONE">,
): string | null {
  return process.env[TICKETING_ADDON[tier].stripePriceIdEnv] ?? null;
}

/** Reverse-lookup: given a Stripe Price ID, return the tier it represents. */
export function getTicketingTierByPriceId(
  priceId: string,
): Exclude<TicketingAddonTier, "NONE"> | null {
  for (const tier of Object.keys(TICKETING_ADDON) as Array<
    Exclude<TicketingAddonTier, "NONE">
  >) {
    if (process.env[TICKETING_ADDON[tier].stripePriceIdEnv] === priceId) {
      return tier;
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Subscription helpers
   ═══════════════════════════════════════════════════════════════ */

/** Read the workspace's current ticketing add-on tier (NONE if not subscribed). */
export async function getTicketingTier(
  workspaceId: string,
): Promise<TicketingAddonTier> {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { ticketingTier: true },
  });
  return sub?.ticketingTier ?? "NONE";
}

/** True if the workspace has any active ticketing add-on tier. */
export async function hasTicketingAddon(workspaceId: string): Promise<boolean> {
  const tier = await getTicketingTier(workspaceId);
  return tier !== "NONE";
}

/* ═══════════════════════════════════════════════════════════════
   API guards (return 402 NextResponse or null)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hard guard for any /api/tickets endpoint. Returns 402 if no add-on, else null.
 */
export async function requireTicketingAddon(
  workspaceId: string,
): Promise<NextResponse | null> {
  const tier = await getTicketingTier(workspaceId);
  if (tier !== "NONE") return null;

  return NextResponse.json(
    {
      error: "ADDON_REQUIRED",
      code: "TICKETING_ADDON_REQUIRED",
      message:
        "Das Ticketsystem ist ein kostenpflichtiges Add-on. Bitte aktivieren Sie es in den Abrechnungseinstellungen.",
      addon: "ticketing",
      upgradeRequired: true,
    },
    { status: 402 },
  );
}

/* ═══════════════════════════════════════════════════════════════
   Monthly ticket-count quota
   ═══════════════════════════════════════════════════════════════ */

/**
 * Reset the monthly ticket counter if the billing period has rolled over (>30 days).
 * Mirrors the pattern used by maybeResetPdfCounter in subscription-guard.ts.
 */
async function maybeResetTicketCounter(workspaceId: string) {
  const usage = await prisma.workspaceUsage.findUnique({
    where: { workspaceId },
    select: { ticketsResetAt: true },
  });
  if (!usage) return;

  const now = new Date();
  const daysSinceReset =
    (now.getTime() - usage.ticketsResetAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceReset >= 30) {
    await prisma.workspaceUsage.update({
      where: { workspaceId },
      data: {
        ticketsCreatedThisMonth: 0,
        ticketsResetAt: now,
      },
    });
  }
}

/** Sync the WorkspaceUsage limit fields to the current ticketing tier. */
export async function syncTicketingLimits(
  workspaceId: string,
  tier: TicketingAddonTier,
) {
  const limits =
    tier === "NONE"
      ? { ticketsMonthlyLimit: 0, ticketStorageBytesLimit: BigInt(0) }
      : {
          ticketsMonthlyLimit: TICKETING_ADDON[tier].ticketsPerMonth,
          ticketStorageBytesLimit: TICKETING_ADDON[tier].storageBytes,
        };

  await prisma.workspaceUsage.upsert({
    where: { workspaceId },
    update: limits,
    create: {
      workspaceId,
      ...limits,
    },
  });
}

/**
 * Check whether the workspace can create another ticket this billing period.
 */
export async function checkTicketQuota(workspaceId: string): Promise<{
  allowed: boolean;
  created: number;
  limit: number;
  tier: TicketingAddonTier;
}> {
  await maybeResetTicketCounter(workspaceId);
  const [usage, tier] = await Promise.all([
    prisma.workspaceUsage.findUnique({
      where: { workspaceId },
      select: { ticketsCreatedThisMonth: true, ticketsMonthlyLimit: true },
    }),
    getTicketingTier(workspaceId),
  ]);

  const created = usage?.ticketsCreatedThisMonth ?? 0;
  const limit = usage?.ticketsMonthlyLimit ?? 0;

  return {
    allowed: tier !== "NONE" && created < limit,
    created,
    limit,
    tier,
  };
}

/**
 * Hard guard for ticket creation. Returns 402/403 NextResponse or null.
 * Combines add-on check + monthly quota check in one call.
 */
export async function requireTicketQuota(
  workspaceId: string,
): Promise<NextResponse | null> {
  const { allowed, created, limit, tier } = await checkTicketQuota(workspaceId);

  if (tier === "NONE") {
    return requireTicketingAddon(workspaceId);
  }

  if (allowed) return null;

  log.warn("[ticketing-addon] Ticket quota exceeded", {
    workspaceId,
    tier,
    created,
    limit,
  });

  return NextResponse.json(
    {
      error: "SUBSCRIPTION_LIMIT",
      code: "TICKET_QUOTA_EXCEEDED",
      message: `Sie haben Ihr monatliches Ticket-Limit von ${limit} erreicht. Bitte upgraden Sie Ihr Ticketing-Add-on.`,
      created,
      limit,
      tier,
      upgradeRequired: true,
    },
    { status: 403 },
  );
}

/** Increment the ticket counter. Call AFTER successfully creating a ticket. */
export async function recordTicketCreation(workspaceId: string) {
  await maybeResetTicketCounter(workspaceId);
  await prisma.workspaceUsage.update({
    where: { workspaceId },
    data: { ticketsCreatedThisMonth: { increment: 1 } },
  });
}
