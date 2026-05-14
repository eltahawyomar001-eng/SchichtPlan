/**
 * One-shot backfill: bring every Stripe subscription's seat quantity into
 * sync with the live active-employee count.
 *
 * Run with: npx tsx scripts/backfill-seats.ts
 *
 * Safe to run repeatedly — skips workspaces that are already in sync.
 * Self-contained: uses Prisma + Stripe directly (no @/ alias dependencies).
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import Stripe from "stripe";

// Load .env.local first, then .env, mirroring Next.js precedence.
config({ path: ".env.local" });
config({ path: ".env" });

const TICKETING_PRICE_IDS = new Set(
  [
    process.env.STRIPE_PRICE_TICKETING_STARTER,
    process.env.STRIPE_PRICE_TICKETING_GROWTH,
    process.env.STRIPE_PRICE_TICKETING_BUSINESS,
  ].filter(Boolean) as string[],
);
const SCHICHTPLANUNG_PRICE_IDS = new Set(
  [
    process.env.STRIPE_PRICE_SCHICHTPLANUNG_MONTHLY,
    process.env.STRIPE_PRICE_SCHICHTPLANUNG_ANNUAL,
  ].filter(Boolean) as string[],
);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
  const stripe = new Stripe(stripeKey);

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      stripeSubscriptionId: { not: null },
      NOT: { stripeSubscriptionId: { startsWith: "sim_" } },
    },
    select: {
      workspaceId: true,
      plan: true,
      seatCount: true,
      stripeSubscriptionId: true,
    },
  });

  console.log(`[Backfill] Found ${subs.length} workspaces to check`);

  for (const sub of subs) {
    const employees = await prisma.employee.count({
      where: { workspaceId: sub.workspaceId, isActive: true },
    });
    const target = Math.max(1, employees);

    console.log(
      `\n[Backfill] ws=${sub.workspaceId} plan=${sub.plan} dbSeats=${sub.seatCount} employees=${employees}`,
    );

    try {
      const liveSub = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId!,
        { expand: ["items"] },
      );

      const mainItem =
        liveSub.items.data.find(
          (it) =>
            !TICKETING_PRICE_IDS.has(it.price.id) &&
            !SCHICHTPLANUNG_PRICE_IDS.has(it.price.id),
        ) ?? liveSub.items.data[0];

      if (!mainItem) {
        console.log(`           → SKIP: no main item found`);
        continue;
      }

      const liveQty = mainItem.quantity ?? 1;
      console.log(
        `           live Stripe quantity = ${liveQty}, target = ${target}`,
      );

      if (liveQty === target) {
        if (sub.seatCount !== target) {
          await prisma.subscription.update({
            where: { workspaceId: sub.workspaceId },
            data: { seatCount: target },
          });
          console.log(
            `           → DB-only heal: ${sub.seatCount} → ${target}`,
          );
        } else {
          console.log(`           → already in sync, no change`);
        }
        continue;
      }

      await stripe.subscriptions.update(sub.stripeSubscriptionId!, {
        items: [{ id: mainItem.id, quantity: target }],
        proration_behavior: "always_invoice",
      });

      await prisma.subscription.update({
        where: { workspaceId: sub.workspaceId },
        data: { seatCount: target },
      });

      console.log(
        `           → STRIPE UPDATED: ${liveQty} → ${target} (prorated invoice issued)`,
      );
    } catch (err) {
      console.error(
        `           → ERROR:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("\n[Backfill] done.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
