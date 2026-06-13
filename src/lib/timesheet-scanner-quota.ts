/* ─────────────────────────────────────────────────────────────────
   Timesheet scanner quota
   ─────────────────────────────────────────────────────────────────
   Monthly scan accounting with automatic period reset.

     • Free tier:    30 scans / month  → at the cap, block + upsell.
     • Premium add-on (€24.99/mo): 600 scans / month (fair-use) → at the
       cap, pause + contact support.

   The counter lives on WorkspaceUsage (alongside the PDF/ticket/email
   counters) and resets at the start of each calendar month.
   ───────────────────────────────────────────────────────────────── */

import { prisma } from "@/lib/db";
import {
  hasTimesheetScannerAddon,
  FREE_SCANS_PER_MONTH,
  PREMIUM_SCANS_PER_MONTH,
} from "@/lib/timesheet-scanner-addon";

export type ScanTier = "free" | "premium";

export interface ScanQuota {
  tier: ScanTier;
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
}

/** First instant (UTC) of the month after `d`. */
export function startOfNextMonthUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

/**
 * Read the live scan quota for a workspace, applying a monthly reset when the
 * billing period has rolled over (counter → 0, resetAt → next month). Ensures a
 * WorkspaceUsage row exists. Safe to call before any AI work.
 */
export async function getScanQuota(workspaceId: string): Promise<ScanQuota> {
  const premium = await hasTimesheetScannerAddon(workspaceId);
  const tier: ScanTier = premium ? "premium" : "free";
  const limit = premium ? PREMIUM_SCANS_PER_MONTH : FREE_SCANS_PER_MONTH;

  const now = new Date();

  const usage = await prisma.workspaceUsage.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      scansThisMonth: 0,
      scansMonthlyLimit: limit,
      scansResetAt: startOfNextMonthUTC(now),
    },
    update: {},
    select: { scansThisMonth: true, scansResetAt: true },
  });

  let used = usage.scansThisMonth;
  let resetAt = usage.scansResetAt;

  // A new billing month has started → reset the counter.
  if (now >= resetAt) {
    resetAt = startOfNextMonthUTC(now);
    used = 0;
    await prisma.workspaceUsage.update({
      where: { workspaceId },
      data: {
        scansThisMonth: 0,
        scansResetAt: resetAt,
        scansMonthlyLimit: limit,
      },
    });
  }

  return {
    tier,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt,
    blocked: used >= limit,
  };
}

/** Increment the monthly scan counter by one (call ONLY after a successful scan). */
export async function consumeScan(workspaceId: string): Promise<void> {
  await prisma.workspaceUsage.update({
    where: { workspaceId },
    data: { scansThisMonth: { increment: 1 } },
  });
}

/** Error payload returned (402) when a tier's monthly cap is reached. */
export function quotaExceededPayload(q: ScanQuota) {
  return {
    error: "SCAN_QUOTA_EXCEEDED" as const,
    tier: q.tier,
    limit: q.limit,
    used: q.used,
    resetAt: q.resetAt.toISOString(),
    // Free tier → upsell the premium add-on; premium → fair-use, contact support.
    upgradeRequired: q.tier === "free",
    contactSupport: q.tier === "premium",
    message:
      q.tier === "free"
        ? `Kostenloses Kontingent von ${q.limit} Scans/Monat erreicht. Upgraden Sie auf das Premium-Modul.`
        : `Fair-Use-Limit von ${q.limit} Scans/Monat erreicht. Bitte kontaktieren Sie den Support.`,
  };
}
