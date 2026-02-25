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

export type PlanId = "starter" | "team" | "business" | "enterprise";

export interface PlanConfig {
  id: PlanId;
  /** Matches Prisma SubscriptionPlan enum */
  prismaKey: "STARTER" | "TEAM" | "BUSINESS" | "ENTERPRISE";
  /** Human-readable name */
  name: string;
  /** Flat monthly workspace price in EUR cents (0 = free/custom) */
  monthlyPriceCents: number;
  /** Flat annual workspace price in EUR cents per month (0 = free/custom) */
  annualPriceCents: number;
  /**
   * Stripe Price IDs — set via env vars.
   * Null means the plan is free or custom-quoted.
   */
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  /** Feature limits */
  limits: {
    maxEmployees: number; // Infinity = unlimited
    maxLocations: number;
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
 */
export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    prismaKey: "STARTER",
    name: "Starter",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    trialDays: 0,
    limits: {
      maxEmployees: 5,
      maxLocations: 1,
      shiftTemplates: false,
      absenceManagement: false,
      csvPdfExport: false,
      datevExport: false,
      datevOnlineUpload: false,
      autoScheduling: false,
      teamChat: false,
      apiWebhooks: false,
      customRoles: false,
      analytics: false,
      prioritySupport: false,
      ssoSaml: false,
      dedicatedSla: false,
      customIntegrations: false,
    },
  },
  team: {
    id: "team",
    prismaKey: "TEAM",
    name: "Team",
    monthlyPriceCents: 2900, // €29 flat/workspace
    annualPriceCents: 2400, // €24 flat/workspace (saves ~17%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_TEAM_ANNUAL ?? null,
    trialDays: 14,
    limits: {
      maxEmployees: Infinity,
      maxLocations: 3,
      shiftTemplates: true,
      absenceManagement: true,
      csvPdfExport: true,
      datevExport: false,
      datevOnlineUpload: false,
      autoScheduling: true,
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
  business: {
    id: "business",
    prismaKey: "BUSINESS",
    name: "Business",
    monthlyPriceCents: 5900, // €59 flat/workspace
    annualPriceCents: 4900, // €49 flat/workspace (saves ~17%)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? null,
    trialDays: 14,
    limits: {
      maxEmployees: Infinity,
      maxLocations: Infinity,
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
    monthlyPriceCents: 0, // custom pricing
    annualPriceCents: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    trialDays: 0,
    limits: {
      maxEmployees: Infinity,
      maxLocations: Infinity,
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
export const PLAN_ORDER: PlanId[] = [
  "starter",
  "team",
  "business",
  "enterprise",
];

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
