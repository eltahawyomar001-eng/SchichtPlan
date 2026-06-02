import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { invalidateSubscriptionCache } from "@/lib/subscription";

/**
 * GET /api/cron/expire-trials
 *
 * Finds TRIALING subscriptions whose trialEnd has passed and that have no
 * real Stripe subscription (i.e. the user never converted). Updates them to
 * CANCELED so the DB reflects reality and the auth repair paths never
 * accidentally re-grant access to lapsed trial workspaces.
 *
 * Runs daily at 05:00 UTC via Vercel Cron.
 */
export const GET = withRoute("/api/cron/expire-trials", "GET", async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  const now = new Date();

  const expired = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEnd: { lt: now },
      stripeSubscriptionId: null,
    },
    select: { id: true, workspaceId: true },
  });

  if (expired.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  await prisma.subscription.updateMany({
    where: { id: { in: expired.map((s) => s.id) } },
    data: { status: "CANCELED" },
  });

  await Promise.all(
    expired.map((s) => invalidateSubscriptionCache(s.workspaceId)),
  );

  log.info("[cron/expire-trials] expired lapsed trial subscriptions", {
    count: expired.length,
    workspaceIds: expired.map((s) => s.workspaceId),
  });

  return NextResponse.json({ expired: expired.length });
});
