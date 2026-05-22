import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
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
 *
 * Failure contract:
 *  - Expiry and DB state updates are committed FIRST, independently of
 *    notification delivery. If email/push fails, the tier advancement is
 *    still persisted so the next cron run doesn't re-escalate the same tier.
 *  - Each SOS is processed independently; one failure doesn't abort others.
 *  - monitor.finish("error") is called when any item fails so Sentry cron
 *    alerts fire instead of silently staying "in_progress".
 */
export const GET = withRoute(
  "/api/automations/sos-escalation",
  "GET",
  async (req) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 401 },
      );
    }

    const monitor = cronMonitor("sos-escalation", "*/5 * * * *");

    try {
      const now = new Date();
      const itemErrors: string[] = [];

      // ── 1. Expire overdue open requests ────────────────────────
      const expired = await prisma.sosRequest.updateMany({
        where: { status: "OPEN", expiresAt: { lte: now } },
        data: { status: "EXPIRED" },
      });

      if (expired.count > 0) {
        log.info(
          `[SOS escalation] Expired ${expired.count} overdue SOS requests`,
        );

        await prisma.sosNotification.updateMany({
          where: {
            response: "PENDING",
            sosRequest: { status: "EXPIRED" },
          },
          data: { response: "EXPIRED", respondedAt: now },
        });

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

      // ── 2. Escalate ready requests ──────────────────────────────
      const readyToEscalate = await prisma.sosRequest.findMany({
        where: {
          status: "OPEN",
          nextEscalationAt: { lte: now },
          escalationTier: { lt: 3 },
        },
        include: {
          shift: { include: { location: { select: { name: true } } } },
        },
      });

      for (const sos of readyToEscalate) {
        try {
          const nextTier = sos.escalationTier + 1;

          const ranked = await rankEmployeesForSos(
            sos.shift,
            sos.workspaceId,
            sos.shift.employeeId,
          );

          const alreadyNotified = await prisma.sosNotification.findMany({
            where: { sosRequestId: sos.id },
            select: { employeeId: true },
          });
          const notifiedIds = new Set(alreadyNotified.map((n) => n.employeeId));
          const freshRanked = ranked.filter((r) => !notifiedIds.has(r.id));
          const tierSlice = getTierSlice(freshRanked, nextTier);

          // ── Commit DB state FIRST, before notifications ──────────
          // This guarantees the tier is advanced even if email/push fails.
          // On retry, the next cron run won't re-escalate the same tier.
          const nextEscalationAt =
            nextTier < 3 ? new Date(now.getTime() + 15 * 60 * 1000) : null;

          await prisma.sosRequest.update({
            where: { id: sos.id },
            data: { escalationTier: nextTier, nextEscalationAt },
          });

          // ── Notify employees (best-effort after DB is committed) ──
          if (tierSlice.length > 0) {
            try {
              await notifyEmployeeTier(
                sos.id,
                tierSlice,
                nextTier,
                sos.shift as Parameters<typeof notifyEmployeeTier>[3],
                sos.bonusAmount ? Number(sos.bonusAmount) : null,
                sos.bonusCurrency,
                sos.bonusNote,
              );
            } catch (notifyErr) {
              // Notification failure is logged but does NOT roll back the tier
              // advancement — the DB is already committed. Audit events still
              // fire so the control room shows the escalation even without delivery.
              log.error(
                `[SOS escalation] notify failed for SOS ${sos.id} tier ${nextTier}`,
                {
                  error:
                    notifyErr instanceof Error
                      ? notifyErr.message
                      : String(notifyErr),
                },
              );
              itemErrors.push(
                `SOS ${sos.id} tier ${nextTier}: notification delivery failed`,
              );
            }

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
        } catch (itemErr) {
          const msg = `SOS ${sos.id}: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`;
          itemErrors.push(msg);
          log.error(`[SOS escalation] item error — ${msg}`, { error: itemErr });
          captureRouteError(itemErr, {
            route: "/api/automations/sos-escalation",
            method: "GET",
          });
        }
      }

      const hadErrors = itemErrors.length > 0;
      monitor.finish(hadErrors ? "error" : "ok");

      return NextResponse.json({
        ok: !hadErrors,
        expired: expired.count,
        escalated: readyToEscalate.length,
        errors: hadErrors ? itemErrors : undefined,
      });
    } catch (err) {
      log.error("[SOS escalation] cron fatal error", { error: err });
      captureRouteError(err, {
        route: "/api/automations/sos-escalation",
        method: "GET",
      });
      monitor.finish("error");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
);
