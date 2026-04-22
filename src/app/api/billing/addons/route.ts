import { NextResponse } from "next/server";
import { requireAuth, serverError } from "@/lib/api-response";
import { captureRouteError } from "@/lib/sentry";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { TICKETING_ADDON, getTicketingTier } from "@/lib/ticketing-addon";
import {
  SCHICHTPLANUNG_ADDON,
  hasSchichtplanungAddon,
} from "@/lib/schichtplanung-addon";

/**
 * GET /api/billing/addons
 *
 * Returns the workspace's current add-on subscriptions and usage.
 * Used by the sidebar (badge), the billing settings page, and ticket
 * pages for client-side fallback redirects.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { workspaceId } = auth;

    const [tier, usage, sub, schichtplanungActive] = await Promise.all([
      getTicketingTier(workspaceId),
      prisma.workspaceUsage.findUnique({
        where: { workspaceId },
        select: {
          ticketsCreatedThisMonth: true,
          ticketsMonthlyLimit: true,
          ticketStorageBytesUsed: true,
          ticketStorageBytesLimit: true,
          ticketsResetAt: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { workspaceId },
        select: {
          plan: true,
          seatCount: true,
          schichtplanungAddonActive: true,
          schichtplanungAddonBilling: true,
        },
      }),
      hasSchichtplanungAddon(workspaceId),
    ]);

    const rawTierConfig = tier === "NONE" ? null : TICKETING_ADDON[tier];
    const tierConfig = rawTierConfig
      ? {
          id: rawTierConfig.id,
          name: rawTierConfig.name,
          priceMonthlyCents: rawTierConfig.priceMonthlyCents,
          ticketsPerMonth: rawTierConfig.ticketsPerMonth,
          storageGb: rawTierConfig.storageGb,
          storageBytes: rawTierConfig.storageBytes.toString(),
        }
      : null;

    return NextResponse.json({
      ticketing: {
        tier,
        active: tier !== "NONE",
        tierConfig,
        usage: {
          ticketsCreated: usage?.ticketsCreatedThisMonth ?? 0,
          ticketsLimit: usage?.ticketsMonthlyLimit ?? 0,
          storageBytesUsed: usage?.ticketStorageBytesUsed?.toString() ?? "0",
          storageBytesLimit: usage?.ticketStorageBytesLimit?.toString() ?? "0",
          resetAt: usage?.ticketsResetAt ?? null,
        },
      },
      // Available tiers for upgrade UI (BigInt → string for JSON safety)
      availableTiers: Object.values(TICKETING_ADDON).map((t) => ({
        id: t.id,
        name: t.name,
        priceMonthlyCents: t.priceMonthlyCents,
        ticketsPerMonth: t.ticketsPerMonth,
        storageGb: t.storageGb,
        storageBytes: t.storageBytes.toString(),
      })),
      schichtplanung: {
        active: schichtplanungActive,
        // null when not subscribed; "monthly" | "annual" otherwise
        billing: sub?.schichtplanungAddonBilling ?? null,
        // Free with Enterprise plan
        freeWithPlan: sub?.plan === "ENTERPRISE",
        // Per-user pricing for UI display
        perUserMonthlyCents: SCHICHTPLANUNG_ADDON.perUserMonthlyCents,
        perUserAnnualCents: SCHICHTPLANUNG_ADDON.perUserAnnualCents,
        // Current seat count drives the per-user quantity on Stripe
        seatCount: sub?.seatCount ?? 1,
      },
    });
  } catch (error) {
    log.error("Error fetching addons:", { error });
    captureRouteError(error, { route: "/api/billing/addons", method: "GET" });
    return serverError("Fehler beim Laden der Add-ons");
  }
}
