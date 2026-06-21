/**
 * Create (or reuse) every Stripe product + price the app needs, in whichever
 * mode the STRIPE_SECRET_KEY belongs to (test or live). Amounts mirror the
 * single source of truth in src/lib/stripe.ts and the add-on configs exactly.
 *
 * Run with:   npx tsx scripts/create-live-prices.ts
 *   - Reads STRIPE_SECRET_KEY from .env.local then .env (Next.js precedence).
 *   - To target LIVE, set STRIPE_SECRET_KEY=sk_live_… in the environment, e.g.
 *       STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-live-prices.ts
 *
 * Idempotent: prices are looked up by `lookup_key`, so re-running reuses
 * existing prices instead of creating duplicates. Stripe prices are immutable;
 * if you need to change an amount, archive the old price in the dashboard and
 * bump the lookup_key here.
 *
 * On success it prints a ready-to-paste block of STRIPE_PRICE_* env vars.
 *
 * Self-contained: uses Stripe directly, no @/ alias dependencies.
 */
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });
config({ path: ".env" });

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("✖ STRIPE_SECRET_KEY is not set. Aborting.");
  process.exit(1);
}
const MODE = key.startsWith("sk_live_") ? "LIVE" : "TEST";

// Stripe Tax: prices are NET (VAT added on top), standard for German B2B SaaS.
// Set a SaaS tax code on each product so Stripe Tax picks the right rate.
// Verify this code fits your offering in the Stripe Tax dashboard.
const TAX_BEHAVIOR: Stripe.PriceCreateParams["tax_behavior"] = "exclusive";
const SAAS_TAX_CODE = process.env.STRIPE_SAAS_TAX_CODE ?? "txcd_10103001"; // SaaS — business use

const stripe = new Stripe(key, { apiVersion: "2026-01-28.clover" });

type Interval = "month" | "year";
interface PriceSpec {
  /** Env var the app reads this price from */
  envVar: string;
  /** Stable product identity (also the lookup_key prefix) */
  productKey: string;
  productName: string;
  amountCents: number;
  interval: Interval;
}

/**
 * Amounts mirror:
 *   - src/lib/stripe.ts PLANS (annual = per-user-monthly × 12, billed yearly)
 *   - src/lib/ticketing-addon.ts (flat monthly per tier)
 *   - src/lib/schichtplanung-addon.ts (per-user)
 *   - src/lib/timesheet-scanner-addon.ts (flat monthly)
 */
const SPECS: PriceSpec[] = [
  // ── Core plans (per-seat: quantity = active employees) ──
  {
    envVar: "STRIPE_PRICE_BASIC_MONTHLY",
    productKey: "plan_basic",
    productName: "Shiftfy Basic",
    amountCents: 299,
    interval: "month",
  },
  {
    envVar: "STRIPE_PRICE_BASIC_ANNUAL",
    productKey: "plan_basic",
    productName: "Shiftfy Basic",
    amountCents: 2988,
    interval: "year",
  }, // €2.49 × 12
  {
    envVar: "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
    productKey: "plan_professional",
    productName: "Shiftfy Professional",
    amountCents: 499,
    interval: "month",
  },
  {
    envVar: "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
    productKey: "plan_professional",
    productName: "Shiftfy Professional",
    amountCents: 4788,
    interval: "year",
  }, // €3.99 × 12

  // ── Ticketing add-on (flat, quantity 1) ──
  {
    envVar: "STRIPE_PRICE_TICKETING_STARTER_MONTHLY",
    productKey: "addon_ticketing_starter",
    productName: "Shiftfy Ticketing — Starter",
    amountCents: 1899,
    interval: "month",
  },
  {
    envVar: "STRIPE_PRICE_TICKETING_PRO_MONTHLY",
    productKey: "addon_ticketing_growth",
    productName: "Shiftfy Ticketing — Growth",
    amountCents: 3399,
    interval: "month",
  },
  {
    envVar: "STRIPE_PRICE_TICKETING_BUSINESS_MONTHLY",
    productKey: "addon_ticketing_business",
    productName: "Shiftfy Ticketing — Business",
    amountCents: 5599,
    interval: "month",
  },

  // ── Schichtplanung add-on (per-user) ──
  {
    envVar: "STRIPE_PRICE_SCHICHTPLANUNG_MONTHLY",
    productKey: "addon_schichtplanung",
    productName: "Shiftfy Schichtplanung",
    amountCents: 150,
    interval: "month",
  },
  {
    envVar: "STRIPE_PRICE_SCHICHTPLANUNG_ANNUAL",
    productKey: "addon_schichtplanung",
    productName: "Shiftfy Schichtplanung",
    amountCents: 1440,
    interval: "year",
  },

  // ── AI Timesheet Scanner add-on (flat) ──
  {
    envVar: "STRIPE_PRICE_TIMESHEET_SCANNER_MONTHLY",
    productKey: "addon_timesheet_scanner",
    productName: "Shiftfy KI-Stundenzettel-Scanner",
    amountCents: 2499,
    interval: "month",
  },
];

/** Find an existing product by our stable metadata key, or create it. */
const productCache = new Map<string, string>();
async function ensureProduct(spec: PriceSpec): Promise<string> {
  if (productCache.has(spec.productKey))
    return productCache.get(spec.productKey)!;

  const search = await stripe.products.search({
    query: `metadata['shiftfy_key']:'${spec.productKey}' AND active:'true'`,
  });
  let productId = search.data[0]?.id;
  if (!productId) {
    const product = await stripe.products.create({
      name: spec.productName,
      tax_code: SAAS_TAX_CODE,
      metadata: { shiftfy_key: spec.productKey },
    });
    productId = product.id;
    console.log(`  + product ${spec.productKey} → ${productId}`);
  } else {
    console.log(`  = product ${spec.productKey} (exists) → ${productId}`);
  }
  productCache.set(spec.productKey, productId);
  return productId;
}

/** Find an existing price by lookup_key, or create it. Returns the price id. */
async function ensurePrice(spec: PriceSpec): Promise<string> {
  const lookupKey = `shiftfy_${spec.envVar.replace("STRIPE_PRICE_", "").toLowerCase()}_${MODE.toLowerCase()}`;

  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) {
    console.log(`  = price  ${spec.envVar} (exists) → ${existing.data[0].id}`);
    return existing.data[0].id;
  }

  const productId = await ensureProduct(spec);
  const price = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: spec.amountCents,
    tax_behavior: TAX_BEHAVIOR,
    recurring: { interval: spec.interval },
    lookup_key: lookupKey,
    metadata: { env_var: spec.envVar },
  });
  console.log(`  + price  ${spec.envVar} → ${price.id}`);
  return price.id;
}

async function main() {
  console.log(
    `\n▶ Creating Stripe catalog in ${MODE} mode (tax_behavior=${TAX_BEHAVIOR}, tax_code=${SAAS_TAX_CODE})\n`,
  );

  const out: Record<string, string> = {};
  for (const spec of SPECS) {
    out[spec.envVar] = await ensurePrice(spec);
  }

  console.log(`\n────────────────────────────────────────────────────────`);
  console.log(`  Paste these into Vercel → Production env (${MODE} keys):`);
  console.log(`────────────────────────────────────────────────────────`);
  for (const [k, v] of Object.entries(out)) {
    console.log(`${k}=${v}`);
  }
  console.log(
    `\n✔ Done. Remember: also set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (${MODE}).\n`,
  );
}

main().catch((err) => {
  console.error("✖ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
