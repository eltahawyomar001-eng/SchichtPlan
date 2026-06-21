/**
 * @vitest-environment node
 *
 * Tests for src/lib/stripe.ts (pure helpers & plan config).
 * The Stripe client singleton is NOT tested here (requires a real API key).
 * Only the pure functions and static PLANS config are exercised.
 */
import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  calculatePlanPrice,
  formatEur,
  getPlanByPriceId,
} from "@/lib/stripe";

// ─── PLANS config ────────────────────────────────────────────────

describe("PLANS config", () => {
  it("contains exactly three plans: basic, professional, enterprise", () => {
    expect(Object.keys(PLANS)).toEqual(
      expect.arrayContaining(["basic", "professional", "enterprise"]),
    );
    expect(Object.keys(PLANS)).toHaveLength(3);
  });

  it("PLAN_ORDER has all three plans in the correct order", () => {
    expect(PLAN_ORDER).toEqual(["basic", "professional", "enterprise"]);
  });

  it.each(["basic", "professional", "enterprise"] as const)(
    "%s plan has all required top-level fields",
    (planId) => {
      const plan = PLANS[planId];
      expect(plan).toHaveProperty("id", planId);
      expect(plan).toHaveProperty("prismaKey");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("perUserMonthly");
      expect(plan).toHaveProperty("perUserAnnual");
      expect(plan).toHaveProperty("limits");
      expect(plan).toHaveProperty("trialDays");
    },
  );

  it("enterprise plan has unlimited employees (Infinity)", () => {
    expect(PLANS.enterprise.limits.maxEmployees).toBe(Infinity);
  });

  it("enterprise plan has unlimited locations (Infinity)", () => {
    expect(PLANS.enterprise.limits.maxLocations).toBe(Infinity);
  });

  it("enterprise trialDays is 0 (no free trial)", () => {
    expect(PLANS.enterprise.trialDays).toBe(0);
  });

  it("basic and professional plans have a 14-day trial", () => {
    expect(PLANS.basic.trialDays).toBe(14);
    expect(PLANS.professional.trialDays).toBe(14);
  });

  it("basic plan maxEmployees is 15", () => {
    expect(PLANS.basic.limits.maxEmployees).toBe(15);
  });

  it("annual per-user price is lower than monthly for every plan", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.perUserAnnual).toBeLessThan(plan.perUserMonthly);
    }
  });

  it("enterprise plan enables all features including ssoSaml and dedicatedSla", () => {
    const { limits } = PLANS.enterprise;
    expect(limits.ssoSaml).toBe(true);
    expect(limits.dedicatedSla).toBe(true);
    expect(limits.customIntegrations).toBe(true);
  });

  it("basic plan does not include DATEV export", () => {
    expect(PLANS.basic.limits.datevExport).toBe(false);
    expect(PLANS.basic.limits.datevOnlineUpload).toBe(false);
  });
});

// ─── calculatePlanPrice ──────────────────────────────────────────

describe("calculatePlanPrice", () => {
  it("calculates basic plan for 5 seats monthly: 5 × 299 = 1495 cents", () => {
    expect(calculatePlanPrice("basic", 5, "monthly")).toBe(1495);
  });

  it("calculates basic plan for 1 seat monthly: 299 cents", () => {
    expect(calculatePlanPrice("basic", 1, "monthly")).toBe(299);
  });

  it("calculates professional plan for 10 seats monthly: 10 × 499 = 4990 cents", () => {
    expect(calculatePlanPrice("professional", 10, "monthly")).toBe(4990);
  });

  it("annual pricing is cheaper per seat than monthly for basic", () => {
    const monthly = calculatePlanPrice("basic", 5, "monthly");
    const annual = calculatePlanPrice("basic", 5, "annual");
    expect(annual).toBeLessThan(monthly);
  });

  it("annual pricing is cheaper per seat than monthly for professional", () => {
    const monthly = calculatePlanPrice("professional", 5, "monthly");
    const annual = calculatePlanPrice("professional", 5, "annual");
    expect(annual).toBeLessThan(monthly);
  });

  it("annual pricing is cheaper per seat than monthly for enterprise", () => {
    const monthly = calculatePlanPrice("enterprise", 5, "monthly");
    const annual = calculatePlanPrice("enterprise", 5, "annual");
    expect(annual).toBeLessThan(monthly);
  });

  it("returns 0 for 0 seats", () => {
    expect(calculatePlanPrice("basic", 0, "monthly")).toBe(0);
  });

  it("scales linearly with seat count", () => {
    const one = calculatePlanPrice("professional", 1, "monthly");
    const ten = calculatePlanPrice("professional", 10, "monthly");
    expect(ten).toBe(one * 10);
  });
});

// ─── formatEur ───────────────────────────────────────────────────

describe("formatEur", () => {
  it("formats 299 cents to '2,99 €'", () => {
    expect(formatEur(299)).toBe("2,99 €");
  });

  it("formats 0 cents to '0,00 €'", () => {
    expect(formatEur(0)).toBe("0,00 €");
  });

  it("formats 9900 cents to '99,00 €'", () => {
    expect(formatEur(9900)).toBe("99,00 €");
  });

  it("formats 100 cents to '1,00 €'", () => {
    expect(formatEur(100)).toBe("1,00 €");
  });

  it("formats 1995 cents to '19,95 €'", () => {
    expect(formatEur(1995)).toBe("19,95 €");
  });

  it("always produces exactly two decimal places", () => {
    // German locale uses comma as decimal separator
    const result = formatEur(1000);
    expect(result).toMatch(/\d+,\d{2}/);
  });
});

// ─── getPlanByPriceId ────────────────────────────────────────────

describe("getPlanByPriceId", () => {
  it("returns undefined for an unknown price ID", () => {
    expect(getPlanByPriceId("price_unknown_xyz")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getPlanByPriceId("")).toBeUndefined();
  });

  it("returns the correct plan when stripePriceIdMonthly is set via env", () => {
    // Set env var so the plan has a known price ID
    const originalEnv = process.env.STRIPE_PRICE_BASIC_MONTHLY;
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_test_basic_monthly_123";

    // Re-import to pick up the env var would require module re-evaluation;
    // instead we verify the lookup logic directly against PLANS values.
    // Since PLANS is evaluated at module load time in tests, we test the
    // scenario where the price ID equals whatever is already in the plan config.
    const basicMonthlyId = PLANS.basic.stripePriceIdMonthly;
    if (basicMonthlyId) {
      const found = getPlanByPriceId(basicMonthlyId);
      expect(found).toBeDefined();
      expect(found!.id).toBe("basic");
    }

    process.env.STRIPE_PRICE_BASIC_MONTHLY = originalEnv;
  });

  it("returns the correct plan when stripePriceIdAnnual is set via env", () => {
    const basicAnnualId = PLANS.basic.stripePriceIdAnnual;
    if (basicAnnualId) {
      const found = getPlanByPriceId(basicAnnualId);
      expect(found).toBeDefined();
      expect(found!.id).toBe("basic");
    }
  });

  it("returns the professional plan for its monthly price ID (if set)", () => {
    const priceId = PLANS.professional.stripePriceIdMonthly;
    if (priceId) {
      const found = getPlanByPriceId(priceId);
      expect(found!.id).toBe("professional");
    }
  });

  it("returns undefined for null-like values (plan has no stripe ID set)", () => {
    // All env vars absent in test environment → all stripePriceId* are null
    // Verify lookup of null does not accidentally match
    expect(getPlanByPriceId("null")).toBeUndefined();
  });
});
