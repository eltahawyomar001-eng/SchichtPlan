import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import {
  ensureWorkspaceUsage,
  countOccupiedSlots,
} from "@/lib/subscription-guard";
import { getWorkspacePlan } from "@/lib/subscription";
import { log } from "@/lib/logger";

/**
 * GET /api/billing/usage
 *
 * Returns metered-usage snapshot for the workspace's billing dashboard:
 *   { employees: { used, limit }, locations: { used, limit },
 *     storageMb: { used, limit }, pdfsThisMonth: { used, limit } }
 *
 * Limits of 999999 are returned as null to mean "unlimited" so the UI
 * can render an infinity glyph instead of a misleading bar.
 */
export const GET = withRoute("/api/billing/usage", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  try {
    const [usage, plan, locationCount, occupiedSlots] = await Promise.all([
      ensureWorkspaceUsage(workspaceId),
      getWorkspacePlan(workspaceId),
      prisma.location.count({ where: { workspaceId } }),
      countOccupiedSlots(workspaceId),
    ]);

    const unlimited = (n: number) => (n >= 999999 ? null : n);
    const maxLocations =
      plan?.limits.maxLocations === Infinity || !plan
        ? null
        : plan.limits.maxLocations;

    const storageBytesUsed = Number(usage.storageBytesUsed);
    const storageBytesLimit = Number(usage.storageBytesLimit);
    const usedMb = Math.round((storageBytesUsed / (1024 * 1024)) * 10) / 10;
    const limitMb = Math.round(storageBytesLimit / (1024 * 1024));

    return NextResponse.json({
      employees: {
        used: occupiedSlots,
        limit: unlimited(usage.userSlotsTotal),
      },
      locations: {
        used: locationCount,
        limit: maxLocations,
      },
      storageMb: {
        used: usedMb,
        limit: limitMb >= 49000 ? null : limitMb, // 50 GB sentinel = unlimited
      },
      pdfsThisMonth: {
        used: usage.pdfsGeneratedThisMonth,
        limit: unlimited(usage.pdfsMonthlyLimit),
      },
      ticketsThisMonth: {
        used: usage.ticketsCreatedThisMonth,
        limit: usage.ticketsMonthlyLimit > 0 ? usage.ticketsMonthlyLimit : null,
      },
      emailsThisMonth: {
        used: usage.emailsSentThisMonth,
        limit:
          usage.emailsMonthlyLimit === -1 ? null : usage.emailsMonthlyLimit,
      },
    });
  } catch (err) {
    log.error("[Billing] usage snapshot failed", {
      error: err instanceof Error ? err.message : String(err),
      workspaceId,
    });
    return NextResponse.json({ error: "USAGE_LOAD_FAILED" }, { status: 500 });
  }
});
