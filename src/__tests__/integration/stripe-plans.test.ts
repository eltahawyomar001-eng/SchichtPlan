/**
 * @vitest-environment node
 *
 * Stripe plan configuration and utility tests.
 * Ensures plan definitions are consistent and helpers work correctly.
 */
import { describe, it, expect } from "vitest";
import { PLANS, PLAN_ORDER, formatEur, type PlanId } from "@/lib/stripe";

describe("stripe plan config", () => {
  // ─── Plan Structure Invariants ─────────────────────────────

  describe("plan structure", () => {
    it("has exactly 4 plans", () => {
      expect(Object.keys(PLANS)).toHaveLength(4);
    });

    it("PLAN_ORDER includes all plan IDs", () => {
      expect(PLAN_ORDER).toEqual(["starter", "team", "business", "enterprise"]);
    });

    it("every plan has all required fields", () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.id).toBeDefined();
        expect(plan.prismaKey).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(typeof plan.monthlyPriceCents).toBe("number");
        expect(typeof plan.annualPriceCents).toBe("number");
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
  });

  // ─── Pricing Logic ────────────────────────────────────────

  describe("pricing", () => {
    it("starter is free", () => {
      expect(PLANS.starter.monthlyPriceCents).toBe(0);
      expect(PLANS.starter.annualPriceCents).toBe(0);
    });

    it("annual price is cheaper than monthly for paid plans", () => {
      for (const id of ["team", "business"] as PlanId[]) {
        const plan = PLANS[id];
        if (plan.monthlyPriceCents > 0) {
          expect(plan.annualPriceCents).toBeLessThan(plan.monthlyPriceCents);
        }
      }
    });

    it("starter has no trial", () => {
      expect(PLANS.starter.trialDays).toBe(0);
    });

    it("team and business have 14-day trials", () => {
      expect(PLANS.team.trialDays).toBe(14);
      expect(PLANS.business.trialDays).toBe(14);
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
