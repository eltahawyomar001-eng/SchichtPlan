/**
 * One-time migration: promote existing INCOMPLETE subscriptions to a 7-day trial.
 *
 * Workspaces that registered before the trial system existed have status=INCOMPLETE
 * and are completely locked out. This script gives them a fresh 7-day window so
 * they can explore the app and decide to subscribe.
 *
 * Run once:
 *   npx tsx scripts/migrate-trial.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  // Only touch rows that are truly stuck — INCOMPLETE with no Stripe subscription.
  // Rows with stripeSubscriptionId should be reconciled via webhook, not this script.
  const result = await prisma.subscription.updateMany({
    where: {
      status: "INCOMPLETE",
      stripeSubscriptionId: null,
    },
    data: {
      status: "TRIALING",
      trialStart: now,
      trialEnd,
    },
  });

  console.log(
    `Migrated ${result.count} subscription(s) to TRIALING (7-day trial).`,
  );

  // Also fix the expired TRIALING account (trialEnd in the past, but has an active
  // Stripe sub and currentPeriodEnd in the future → should be ACTIVE).
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEnd: { lt: now },
      stripeSubscriptionId: { not: null },
      currentPeriodEnd: { gt: now },
    },
    select: { id: true, workspaceId: true },
  });

  if (expiredTrials.length > 0) {
    await prisma.subscription.updateMany({
      where: { id: { in: expiredTrials.map((s) => s.id) } },
      data: { status: "ACTIVE" },
    });
    console.log(
      `Fixed ${expiredTrials.length} expired-trial subscription(s) with active Stripe sub → ACTIVE.`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
