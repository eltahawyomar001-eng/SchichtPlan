import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { ensureWorkspaceUsage } from "@/lib/subscription-guard";
import { getWorkspacePlan } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { getTicketStorageBreakdown } from "@/lib/ticket-trash";

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
    // Pull the live source-of-truth counts every request — no cache, no stale
    // metadata. The displayed "employees" count MUST equal the active-employee
    // count, which is also exactly what Stripe bills as the seat quantity
    // and what the seat-drift card reports. Pending invitations are tracked
    // separately and shown alongside, but never folded into the main number,
    // so the three views (usage bar / seat-sync card / Stripe invoice) all
    // read the same value.
    const [
      usage,
      plan,
      locationCount,
      activeEmployees,
      pendingInvitations,
      ticketStorage,
      storageRows,
    ] = await Promise.all([
      ensureWorkspaceUsage(workspaceId),
      getWorkspacePlan(workspaceId),
      prisma.location.count({ where: { workspaceId } }),
      prisma.employee.count({ where: { workspaceId, isActive: true } }),
      prisma.invitation.count({
        where: { workspaceId, status: "PENDING" },
      }),
      getTicketStorageBreakdown(workspaceId),
      // Query actual Supabase storage instead of the manually-incremented counter.
      // The counter only tracks ticket attachments and service-visit signatures,
      // misses direct uploads, and never decrements on delete — so it always drifts.
      // storage.objects paths follow: {workspaceId}/{...}
      prisma.$queryRaw<[{ total_bytes: bigint }]>`
        SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS total_bytes
        FROM storage.objects
        WHERE name LIKE ${workspaceId + "/%"}
      `,
    ]);

    const unlimited = (n: number) => (n >= 999999 ? null : n);
    const maxLocations =
      plan?.limits.maxLocations === Infinity || !plan
        ? null
        : plan.limits.maxLocations;

    // Use live Supabase storage query; fall back to counter if query returns nothing.
    const storageBytesUsed = Number(
      (storageRows as [{ total_bytes: bigint }])[0]?.total_bytes ??
        usage.storageBytesUsed,
    );
    const storageBytesLimit = Number(usage.storageBytesLimit);
    const usedMb = Math.round((storageBytesUsed / (1024 * 1024)) * 10) / 10;
    const limitMb = Math.round(storageBytesLimit / (1024 * 1024));

    return NextResponse.json({
      employees: {
        used: activeEmployees,
        pendingInvitations,
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
      tickets: {
        active: ticketStorage.activeTickets,
        trash: ticketStorage.trashTickets,
      },
      ticketStorageBytes: {
        active: ticketStorage.activeBytes,
        trash: ticketStorage.trashBytes,
        total: ticketStorage.totalBytes,
        limit: Number(usage.ticketStorageBytesLimit),
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
