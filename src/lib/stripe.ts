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
    pdfMonthlyLimit: number; // Infinity = unlimited
    shiftTemplates: boolean;
    absenceManagement: boolean;
    csvPdfExport: boolean;
    datevExport: boolean;
    datevOnlineUpload: boolean;
    autoScheduling: boolean;
    eSignatures: boolean;
    teamChat: boolean;
    apiWebhooks: boolean;
    customRoles: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    ssoSaml: boolean;
    dedicatedSla: boolean;
    customIntegrations: boolean;
  };
  /** Trial period in days. Always 0 — Shiftfy does not offer trial periods. */
  trialDays: number;
}

/**
 * All plan configurations.
 * Stripe Price IDs come from env so they work across
 * test / live mode without code changes.
 *
 * Pricing model (pure per-user, no base fee):
 *   Basic:        €2.99 / user / month  (annual: €2.49)
 *   Professional: €4.99 / user / month  (annual: €3.99)
 *   Enterprise:   €7.99 / user / month  (annual: €6.49)
 */
export const PLANS: Record<PlanId, PlanConfig> = {
  basic: {
    id: "basic",
    prismaKey: "BASIC",
    name: "Basic",
    basePriceMonthly: 0, // no base fee
    basePriceAnnual: 0,
    perUserMonthly: 299, // €2.99 per user
    perUserAnnual: 249, // €2.49 per user (saves ~17%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BASIC_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? null,
    trialDays: 0,
    limits: {
      maxEmployees: 15,
      maxLocations: 1,
      storageMb: 500,
      pdfMonthlyLimit: 50,
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: false,
      datevOnlineUpload: false,
      autoScheduling: false,
      eSignatures: false,
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
    basePriceMonthly: 0, // no base fee
    basePriceAnnual: 0,
    perUserMonthly: 499, // €4.99 per user
    perUserAnnual: 399, // €3.99 per user (saves ~20%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL ?? null,
    trialDays: 0,
    limits: {
      maxEmployees: 100,
      maxLocations: 10,
      storageMb: 5120, // 5 GB
      pdfMonthlyLimit: 500,
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: true,
      datevOnlineUpload: true,
      autoScheduling: true,
      eSignatures: true,
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
    basePriceMonthly: 0, // per-user pricing
    basePriceAnnual: 0,
    perUserMonthly: 799, // €7.99 per user
    perUserAnnual: 649, // €6.49 per user (saves ~19%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL ?? null,
    trialDays: 0,
    limits: {
      maxEmployees: Infinity,
      maxLocations: Infinity,
      storageMb: Infinity, // 50 GB+ / custom
      pdfMonthlyLimit: Infinity,
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: true,
      datevOnlineUpload: true,
      autoScheduling: true,
      eSignatures: true,
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
