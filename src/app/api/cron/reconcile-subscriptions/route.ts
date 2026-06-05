import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { cronMonitor } from "@/lib/sentry";
import { reconcileWorkspaceFromStripe } from "@/lib/billing-reconcile";

/**
 * GET /api/cron/reconcile-subscriptions
 *
 * Self-healing safety net for missed Stripe webhooks. Stripe gives up
 * retrying a failed webhook after 72h; if that delivery is permanently lost
 * the DB drifts from Stripe in one of two ways:
 *
 *   1. Customer paid but DB shows no active sub  → false paywall
 *   2. Customer churned but DB still grants access → revenue leak
 *
 * The webhook handler remains the primary, real-time path. This cron is the
 * backstop: once a day it walks every workspace that has a Stripe customer and
 * reconciles its subscription against live Stripe state, healing both
 * directions of drift. `allowDowngrade` is ON here (unlike the user-facing
 * /api/billing/sync) so confirmed-terminal subscriptions are revoked.
 *
 * Each workspace is reconciled independently — one Stripe error cannot abort
 * the whole batch. Runs daily at 05:30 UTC via Vercel Cron (just after
 * expire-trials at 05:00).
 */
export const GET = withRoute(
  "/api/cron/reconcile-subscriptions",
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

    const monitor = cronMonitor("reconcile-subscriptions", "30 5 * * *");
    monitor.start();

    try {
      // Only workspaces with a Stripe customer can drift against Stripe.
      // In-app trials with no customer are handled by cron/expire-trials.
      const subs = await prisma.subscription.findMany({
        where: { stripeCustomerId: { not: null } },
        select: { workspaceId: true },
      });

      const summary = {
        scanned: subs.length,
        synced: 0,
        downgraded: 0,
        noop: 0,
        skipped: 0,
        errored: 0,
      };

      for (const { workspaceId } of subs) {
        try {
          const result = await reconcileWorkspaceFromStripe(workspaceId, {
            allowDowngrade: true,
          });
          summary[result.action] += 1;
        } catch (err) {
          // Isolate per-workspace failures so one bad customer record (or a
          // transient Stripe error) doesn't stop the rest of the batch.
          summary.errored += 1;
          log.error("[cron/reconcile-subscriptions] workspace failed", {
            workspaceId,
            err,
          });
        }
      }

      if (summary.synced > 0 || summary.downgraded > 0 || summary.errored > 0) {
        log.info("[cron/reconcile-subscriptions] drift healed", summary);
      }

      monitor.finish("ok");
      return NextResponse.json(summary);
    } catch (err) {
      monitor.finish("error");
      throw err;
    }
  },
);
