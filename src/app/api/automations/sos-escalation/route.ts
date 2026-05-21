import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import {
  rankEmployeesForSos,
  notifyEmployeeTier,
  getTierSlice,
} from "@/lib/sos-ranking";
import { emitSosEvent } from "@/lib/sos-events";
import { log } from "@/lib/logger";

/**
 * GET /api/automations/sos-escalation
 * Cron: every 5 minutes.
 *  1. Expire overdue SOS requests.
 *  2. Escalate to next tier when nextEscalationAt has passed.
 */
export const GET = withRoute(
  "/api/automations/sos-escalation",
  "GET",
  async () => {
    const now = new Date();

    // ── 1. Expire overdue open requests ──────────────────────────
    const expired = await prisma.sosRequest.updateMany({
      where: { status: "OPEN", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });

    if (expired.count > 0) {
      log.info(
        `[SOS escalation] Expired ${expired.count} overdue SOS requests`,
      );

      // Mark their pending notifications as expired too
      await prisma.sosNotification.updateMany({
        where: {
          response: "PENDING",
          sosRequest: { status: "EXPIRED" },
        },
        data: { response: "EXPIRED", respondedAt: now },
      });

      // Emit EXPIRED event per request
      const expiredRequests = await prisma.sosRequest.findMany({
        where: { status: "EXPIRED", expiresAt: { lte: now } },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: expired.count,
      });
      for (const r of expiredRequests) {
        await emitSosEvent({ sosRequestId: r.id, type: "EXPIRED" });
      }
    }

    // ── 2. Escalate ready requests ────────────────────────────────
    const readyToEscalate = await prisma.sosRequest.findMany({
      where: {
        status: "OPEN",
        nextEscalationAt: { lte: now },
        escalationTier: { lt: 3 }, // max 3 tiers
      },
      include: {
        shift: { include: { location: { select: { name: true } } } },
      },
    });

    for (const sos of readyToEscalate) {
      const nextTier = sos.escalationTier + 1;

      // Re-rank (availability may have changed)
      const ranked = await rankEmployeesForSos(
        sos.shift,
        sos.workspaceId,
        sos.shift.employeeId,
      );

      // Skip employees already notified
      const alreadyNotified = await prisma.sosNotification.findMany({
        where: { sosRequestId: sos.id },
        select: { employeeId: true },
      });
      const notifiedIds = new Set(alreadyNotified.map((n) => n.employeeId));
      const freshRanked = ranked.filter((r) => !notifiedIds.has(r.id));

      const tierSlice = getTierSlice(freshRanked, nextTier);

      if (tierSlice.length > 0) {
        await notifyEmployeeTier(
          sos.id,
          tierSlice,
          nextTier,
          sos.shift as Parameters<typeof notifyEmployeeTier>[3],
          sos.bonusAmount ? Number(sos.bonusAmount) : null,
          sos.bonusCurrency,
          sos.bonusNote,
        );
        await emitSosEvent({
          sosRequestId: sos.id,
          type: "ESCALATED",
          metadata: { tier: nextTier },
        });
        await emitSosEvent({
          sosRequestId: sos.id,
          type: "TIER_NOTIFIED",
          metadata: {
            tier: nextTier,
            count: tierSlice.length,
            employees: tierSlice.map((e) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`,
              reliabilityScore: e.reliabilityScore,
            })),
          },
        });
        log.info(
          `[SOS escalation] Escalated ${sos.id} to tier ${nextTier}, notified ${tierSlice.length}`,
        );
      }

      // Set next escalation (15 min between tiers) or null if last tier
      const nextEscalationAt =
        nextTier < 3 ? new Date(now.getTime() + 15 * 60 * 1000) : null;

      await prisma.sosRequest.update({
        where: { id: sos.id },
        data: { escalationTier: nextTier, nextEscalationAt },
      });
    }

    return NextResponse.json({
      ok: true,
      expired: expired.count,
      escalated: readyToEscalate.length,
    });
  },
);
