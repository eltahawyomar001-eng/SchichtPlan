import Stripe from "stripe";

/* ═══════════════════════════════════════════════════════════════
   Stripe client singleton (server-side only)
   ═══════════════════════════════════════════════════════════════ */

let _stripe: Stripe | null = null;

/**
 * Returns a Stripe instance. Throws if STRIPE_SECRET_KEY is missing.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to your .env file.");
  }

  _stripe = new Stripe(key, { apiVersion: "2026-01-28.clover" });
  return _stripe;
}

/* ═══════════════════════════════════════════════════════════════
   Plan definitions — single source of truth
   ═══════════════════════════════════════════════════════════════ */

export type PlanId = "basic" | "professional" | "enterprise";

export interface PlanConfig {
  id: PlanId;
  /** Matches Prisma SubscriptionPlan enum */
  prismaKey: "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
  /** Human-readable name */
  name: string;
  /** Base monthly workspace price in EUR cents (0 = custom) */
  basePriceMonthly: number;
  /** Base annual workspace price in EUR cents per month (0 = custom) */
  basePriceAnnual: number;
  /** Per-user monthly addon in EUR cents (0 = custom) */
  perUserMonthly: number;
  /** Per-user annual addon in EUR cents per month (0 = custom) */
  perUserAnnual: number;
  /**
   * Stripe Price IDs — set via env vars.
   * Null means the plan is custom-quoted.
   */
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  /** Feature limits */
  limits: {
    maxEmployees: number; // Infinity = unlimited
    maxLocations: number;
    storageMb: number; // Infinity = unlimited
    shiftTemplates: boolean;
    absenceManagement: boolean;
    csvPdfExport: boolean;
    datevExport: boolean;
    datevOnlineUpload: boolean;
    autoScheduling: boolean;
    teamChat: boolean;
    apiWebhooks: boolean;
    customRoles: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    ssoSaml: boolean;
    dedicatedSla: boolean;
    customIntegrations: boolean;
  };
  /** 14-day trial available */
  trialDays: number;
}

/**
 * All plan configurations.
 * Stripe Price IDs come from env so they work across
 * test / live mode without code changes.
 *
 * Pricing model:
 *   Basic:        €19 base + €2.50 / user / month
 *   Professional: €49 base + €4.50 / user / month
 *   Enterprise:   Custom (minimum €500 / month)
 */
export const PLANS: Record<PlanId, PlanConfig> = {
  basic: {
    id: "basic",
    prismaKey: "BASIC",
    name: "Basic",
    basePriceMonthly: 1900, // €19 base
    basePriceAnnual: 1600, // €16 base (saves ~16%)
    perUserMonthly: 250, // €2.50 per user
    perUserAnnual: 210, // €2.10 per user (saves ~16%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BASIC_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? null,
    trialDays: 14,
    limits: {
      maxEmployees: 10,
      maxLocations: 1,
      storageMb: 500,
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: false,
      datevOnlineUpload: false,
      autoScheduling: false,
      teamChat: true,
      apiWebhooks: false,
      customRoles: false,
      analytics: false,
      prioritySupport: false,
      ssoSaml: false,
      dedicatedSla: false,
      customIntegrations: false,
    },
  },
  professional: {
    id: "professional",
    prismaKey: "PROFESSIONAL",
    name: "Professional",
    basePriceMonthly: 4900, // €49 base
    basePriceAnnual: 4100, // €41 base (saves ~16%)
    perUserMonthly: 450, // €4.50 per user
    perUserAnnual: 380, // €3.80 per user (saves ~16%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL ?? null,
    trialDays: 14,
    limits: {
      maxEmployees: 50,
      maxLocations: 5,
      storageMb: 5120, // 5 GB
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: true,
      datevOnlineUpload: true,
      autoScheduling: true,
      teamChat: true,
      apiWebhooks: true,
      customRoles: true,
      analytics: true,
      prioritySupport: true,
      ssoSaml: false,
      dedicatedSla: false,
      customIntegrations: false,
    },
  },
  enterprise: {
    id: "enterprise",
    prismaKey: "ENTERPRISE",
    name: "Enterprise",
    basePriceMonthly: 0, // custom pricing (min €500)
    basePriceAnnual: 0,
    perUserMonthly: 0,
    perUserAnnual: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    trialDays: 0,
    limits: {
      maxEmployees: Infinity,
      maxLocations: Infinity,
      storageMb: Infinity, // 50 GB+ / custom
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: true,
      datevOnlineUpload: true,
      autoScheduling: true,
      teamChat: true,
      apiWebhooks: true,
      customRoles: true,
      analytics: true,
      prioritySupport: true,
      ssoSaml: true,
      dedicatedSla: true,
      customIntegrations: true,
    },
  },
};

/** Ordered list for rendering */
export const PLAN_ORDER: PlanId[] = ["basic", "professional", "enterprise"];

/**
 * Calculate total monthly price for a plan with a given number of users.
 * Returns cents.
 */
export function calculatePlanPrice(
  planId: PlanId,
  users: number,
  billing: "monthly" | "annual",
): number {
  const plan = PLANS[planId];
  if (!plan) return 0;
  const base =
    billing === "annual" ? plan.basePriceAnnual : plan.basePriceMonthly;
  const perUser =
    billing === "annual" ? plan.perUserAnnual : plan.perUserMonthly;
  return base + perUser * users;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

/** Look up a plan by its Stripe Price ID */
export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find(
    (p) =>
      p.stripePriceIdMonthly === priceId || p.stripePriceIdAnnual === priceId,
  );
}

/** Format cents to EUR display string */
export function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
