/**
 * @vitest-environment node
 *
 * Stripe plan configuration and utility tests.
 * Ensures plan definitions are consistent and helpers work correctly.
 */
import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  formatEur,
  calculatePlanPrice,
  type PlanId,
} from "@/lib/stripe";

describe("stripe plan config", () => {
  // ─── Plan Structure Invariants ─────────────────────────────

  describe("plan structure", () => {
    it("has exactly 3 plans", () => {
      expect(Object.keys(PLANS)).toHaveLength(3);
    });

    it("PLAN_ORDER includes all plan IDs", () => {
      expect(PLAN_ORDER).toEqual(["basic", "professional", "enterprise"]);
    });

    it("every plan has all required fields", () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.id).toBeDefined();
        expect(plan.prismaKey).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(typeof plan.basePriceMonthly).toBe("number");
        expect(typeof plan.basePriceAnnual).toBe("number");
        expect(typeof plan.perUserMonthly).toBe("number");
        expect(typeof plan.perUserAnnual).toBe("number");
        expect(plan.limits).toBeDefined();
        expect(typeof plan.trialDays).toBe("number");
      }
    });

    it("plan IDs match their object keys", () => {
      for (const [key, plan] of Object.entries(PLANS)) {
        expect(plan.id).toBe(key);
      }
    });

    it("prismaKeys are uppercase versions of IDs", () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.prismaKey).toBe(plan.id.toUpperCase());
      }
    });

    it("all plans have storageMb limit", () => {
      for (const plan of Object.values(PLANS)) {
        expect(typeof plan.limits.storageMb).toBe("number");
        expect(plan.limits.storageMb).toBeGreaterThan(0);
      }
    });
  });

  // ─── Pricing Logic ────────────────────────────────────────

  describe("pricing", () => {
    it("basic has base price of €19/month", () => {
      expect(PLANS.basic.basePriceMonthly).toBe(1900);
    });

    it("basic has per-user price of €2.50/month", () => {
      expect(PLANS.basic.perUserMonthly).toBe(250);
    });

    it("professional has base price of €49/month", () => {
      expect(PLANS.professional.basePriceMonthly).toBe(4900);
    });

    it("professional has per-user price of €4.50/month", () => {
      expect(PLANS.professional.perUserMonthly).toBe(450);
    });

    it("enterprise has zero prices (custom-quoted)", () => {
      expect(PLANS.enterprise.basePriceMonthly).toBe(0);
      expect(PLANS.enterprise.perUserMonthly).toBe(0);
    });

    it("annual base is cheaper than monthly base for paid plans", () => {
      for (const id of ["basic", "professional"] as PlanId[]) {
        const plan = PLANS[id];
        expect(plan.basePriceAnnual).toBeLessThan(plan.basePriceMonthly);
      }
    });

    it("annual per-user is cheaper than monthly per-user for paid plans", () => {
      for (const id of ["basic", "professional"] as PlanId[]) {
        const plan = PLANS[id];
        expect(plan.perUserAnnual).toBeLessThan(plan.perUserMonthly);
      }
    });

    it("basic and professional have 14-day trials", () => {
      expect(PLANS.basic.trialDays).toBe(14);
      expect(PLANS.professional.trialDays).toBe(14);
    });

    it("enterprise has no trial", () => {
      expect(PLANS.enterprise.trialDays).toBe(0);
    });
  });

  // ─── calculatePlanPrice ───────────────────────────────────

  describe("calculatePlanPrice", () => {
    it("returns base + per-user × count for monthly", () => {
      // €19 + 5 × €2.50 = €31.50 → 3150 cents
      expect(calculatePlanPrice("basic", 5, "monthly")).toBe(1900 + 250 * 5);
    });

    it("returns base + per-user × count for annual", () => {
      // €16 + 10 × €2.10 = €37.00 → 3700 cents
      expect(calculatePlanPrice("basic", 10, "annual")).toBe(1600 + 210 * 10);
    });

    it("returns 0 for enterprise (custom-quoted)", () => {
      expect(calculatePlanPrice("enterprise", 100, "monthly")).toBe(0);
    });

    it("returns base only when zero users", () => {
      expect(calculatePlanPrice("professional", 0, "monthly")).toBe(4900);
    });
  });

  // ─── Feature Escalation ───────────────────────────────────

  describe("feature escalation", () => {
    it("features only increase as plans go up", () => {
      const booleanFeatures = [
        "shiftTemplates",
        "absenceManagement",
        "csvPdfExport",
        "datevExport",
        "apiWebhooks",
        "customRoles",
        "analytics",
        "prioritySupport",
        "ssoSaml",
        "dedicatedSla",
        "customIntegrations",
      ] as const;

      for (const feature of booleanFeatures) {
        let previousValue = false;
        for (const planId of PLAN_ORDER) {
          const value = PLANS[planId].limits[feature] as boolean;
          // Once a feature is true, it should stay true
          if (previousValue) {
            expect(value).toBe(true);
          }
          previousValue = value;
        }
      }
    });

    it("maxEmployees increases or stays Infinity across plans", () => {
      let prev = 0;
      for (const planId of PLAN_ORDER) {
        const max = PLANS[planId].limits.maxEmployees;
        expect(max).toBeGreaterThanOrEqual(prev);
        prev = max;
      }
    });

    it("maxLocations increases or stays Infinity across plans", () => {
      let prev = 0;
      for (const planId of PLAN_ORDER) {
        const max = PLANS[planId].limits.maxLocations;
        expect(max).toBeGreaterThanOrEqual(prev);
        prev = max;
      }
    });

    it("storageMb increases across plans", () => {
      let prev = 0;
      for (const planId of PLAN_ORDER) {
        const storage = PLANS[planId].limits.storageMb;
        expect(storage).toBeGreaterThanOrEqual(prev);
        prev = storage;
      }
    });
  });

  // ─── Utility Functions ────────────────────────────────────

  describe("formatEur", () => {
    it("formats cents to EUR currency string", () => {
      const result = formatEur(590);
      // German locale: 5,90 €
      expect(result).toContain("5,90");
      expect(result).toContain("€");
    });

    it("formats zero correctly", () => {
      const result = formatEur(0);
      expect(result).toContain("0,00");
    });

    it("formats large amounts", () => {
      const result = formatEur(99900);
      expect(result).toContain("999,00");
    });
  });
});
