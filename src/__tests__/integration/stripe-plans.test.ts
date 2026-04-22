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
    it("basic has no base price (pure per-user)", () => {
      expect(PLANS.basic.basePriceMonthly).toBe(0);
    });

    it("basic has per-user price of €2.99/month", () => {
      expect(PLANS.basic.perUserMonthly).toBe(299);
    });

    it("professional has no base price (pure per-user)", () => {
      expect(PLANS.professional.basePriceMonthly).toBe(0);
    });

    it("professional has per-user price of €4.99/month", () => {
      expect(PLANS.professional.perUserMonthly).toBe(499);
    });

    it("enterprise has per-user price of €7.99/month", () => {
      expect(PLANS.enterprise.basePriceMonthly).toBe(0);
      expect(PLANS.enterprise.perUserMonthly).toBe(799);
    });

    it("all plans have zero base price (pure per-user model)", () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.basePriceMonthly).toBe(0);
        expect(plan.basePriceAnnual).toBe(0);
      }
    });

    it("annual per-user is cheaper than monthly per-user for all paid plans", () => {
      for (const id of ["basic", "professional", "enterprise"] as PlanId[]) {
        const plan = PLANS[id];
        expect(plan.perUserAnnual).toBeLessThan(plan.perUserMonthly);
      }
    });

    it("no plan offers a trial period", () => {
      expect(PLANS.basic.trialDays).toBe(0);
      expect(PLANS.professional.trialDays).toBe(0);
      expect(PLANS.enterprise.trialDays).toBe(0);
    });
  });

  // ─── calculatePlanPrice ───────────────────────────────────

  describe("calculatePlanPrice", () => {
    it("returns per-user × count for monthly (no base fee)", () => {
      // 5 × €2.99 = €14.95 → 1495 cents
      expect(calculatePlanPrice("basic", 5, "monthly")).toBe(299 * 5);
    });

    it("returns per-user × count for annual", () => {
      // 10 × €2.49 = €24.90 → 2490 cents
      expect(calculatePlanPrice("basic", 10, "annual")).toBe(249 * 10);
    });

    it("returns per-user for enterprise", () => {
      expect(calculatePlanPrice("enterprise", 100, "monthly")).toBe(799 * 100);
    });

    it("returns 0 when zero users", () => {
      expect(calculatePlanPrice("professional", 0, "monthly")).toBe(0);
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
