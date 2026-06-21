/**
 * Go-live cutover cleanup: clear stale TEST-mode Stripe identifiers from every
 * Subscription row so the LIVE Stripe account starts clean.
 *
 * Why: customer/subscription/price/item IDs created in Stripe TEST mode do not
 * exist in LIVE mode. Leaving them would make webhooks fail to link and the
 * checkout route's "No such customer" self-heal would fire needlessly. Since
 * there are NO real paid subscriptions yet, clearing all linkage is safe.
 *
 * What it clears (per row): stripeCustomerId, stripeSubscriptionId,
 * stripePriceId, and the three add-on subscription-item IDs. It deliberately
 * does NOT touch plan/status/trial — entitlement state is preserved; only the
 * Stripe pointers are reset.
 *
 * Run (preview, no writes):   npx tsx scripts/cutover-clear-stripe-ids.ts
 * Run (apply):                npx tsx scripts/cutover-clear-stripe-ids.ts --commit
 *
 * Reads .env.local then .env. Point DATABASE_URL at PRODUCTION when applying.
 * Self-contained: Prisma direct, no @/ alias dependencies.
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const COMMIT = process.argv.includes("--commit");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const candidates = await prisma.subscription.findMany({
    where: {
      OR: [
        { stripeCustomerId: { not: null } },
        { stripeSubscriptionId: { not: null } },
        { stripePriceId: { not: null } },
        { ticketingStripeSubscriptionItemId: { not: null } },
        { schichtplanungStripeSubscriptionItemId: { not: null } },
        { timesheetScannerStripeSubscriptionItemId: { not: null } },
      ],
    },
    select: {
      workspaceId: true,
      plan: true,
      status: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  console.log(
    `\n${candidates.length} Subscription row(s) carry Stripe linkage to clear:\n`,
  );
  for (const c of candidates) {
    console.log(
      `  workspace=${c.workspaceId}  plan=${c.plan}  status=${c.status}  cus=${c.stripeCustomerId ?? "-"}  sub=${c.stripeSubscriptionId ?? "-"}`,
    );
  }

  if (!COMMIT) {
    console.log(
      `\n(dry-run) No changes written. Re-run with --commit to clear these IDs.\n`,
    );
    return;
  }

  const result = await prisma.subscription.updateMany({
    where: {
      workspaceId: { in: candidates.map((c) => c.workspaceId) },
    },
    data: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      ticketingStripeSubscriptionItemId: null,
      schichtplanungStripeSubscriptionItemId: null,
      timesheetScannerStripeSubscriptionItemId: null,
    },
  });
  console.log(`\n✔ Cleared Stripe IDs on ${result.count} row(s).\n`);
}

main()
  .catch((err) => {
    console.error("✖ Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
