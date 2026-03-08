/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mock Prisma before importing modules that depend on it ── */
const { mockSubscriptionFindUnique, mockEmployeeCount, mockLocationCount } =
  vi.hoisted(() => ({
    mockSubscriptionFindUnique: vi.fn(),
    mockEmployeeCount: vi.fn(),
    mockLocationCount: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: mockSubscriptionFindUnique },
    employee: { count: mockEmployeeCount },
    location: { count: mockLocationCount },
  },
}));

import {
  canAddEmployee,
  canAddLocation,
  getWorkspacePlan,
  canUseFeature,
  requirePlanFeature,
  requireEmployeeSlot,
  requireLocationSlot,
} from "@/lib/subscription";
import { PLANS } from "@/lib/stripe";

/* ═══════════════════════════════════════════════════════════════
   Subscription / Feature-Gating — integration tests
   ═══════════════════════════════════════════════════════════════ */

describe("subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getWorkspacePlan ──────────────────────────────────────

  describe("getWorkspacePlan", () => {
    it("returns BASIC plan when no subscription exists", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("basic");
    });

    it("returns BASIC when subscription is CANCELED", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "CANCELED",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("basic");
    });

    it("returns correct plan for ACTIVE subscription", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("professional");
    });

    it("returns correct plan for TRIALING subscription", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "TRIALING",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("basic");
    });

    it("falls back to BASIC for PAST_DUE status", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "PAST_DUE",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("basic");
    });
  });

  // ─── canUseFeature ─────────────────────────────────────────

  describe("canUseFeature", () => {
    it("basic cannot use datevExport", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      expect(await canUseFeature("ws-1", "datevExport")).toBe(false);
    });

    it("basic cannot use customRoles", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      expect(await canUseFeature("ws-1", "customRoles")).toBe(false);
    });

    it("professional can use datevExport", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "datevExport")).toBe(true);
    });

    it("professional can use customRoles", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "customRoles")).toBe(true);
    });

    it("basic can use absenceManagement", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "absenceManagement")).toBe(true);
    });

    it("basic cannot use apiWebhooks", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "apiWebhooks")).toBe(false);
    });
  });

  // ─── requirePlanFeature (server-side guard) ────────────────

  describe("requirePlanFeature", () => {
    it("returns null when feature is allowed", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
      });
      const result = await requirePlanFeature("ws-1", "datevExport");
      expect(result).toBeNull();
    });

    it("returns 403 with PLAN_LIMIT error when feature is gated", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null); // basic default
      const result = await requirePlanFeature("ws-1", "datevExport");

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);

      const body = await result!.json();
      expect(body.error).toBe("PLAN_LIMIT");
      expect(body.feature).toBe("datevExport");
    });
  });

  // ─── canAddEmployee / requireEmployeeSlot ──────────────────

  describe("canAddEmployee", () => {
    it("allows adding when under the limit (basic: 10 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(5);

      expect(await canAddEmployee("ws-1")).toBe(true);
    });

    it("blocks when at the limit (basic: 10 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(10);

      expect(await canAddEmployee("ws-1")).toBe(false);
    });

    it("allows for professional plan (50 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(30);

      expect(await canAddEmployee("ws-1")).toBe(true);
    });

    it("allows when no subscription exists (defaults apply)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      expect(await canAddEmployee("ws-1")).toBe(true);
    });
  });

  describe("requireEmployeeSlot", () => {
    it("returns null when slots available", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(2);

      expect(await requireEmployeeSlot("ws-1")).toBeNull();
    });

    it("returns 403 when at limit", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(10);

      const result = await requireEmployeeSlot("ws-1");
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);

      const body = await result!.json();
      expect(body.error).toBe("PLAN_LIMIT");
      expect(body.feature).toBe("maxEmployees");
      expect(body.limit).toBe(10);
    });
  });

  // ─── canAddLocation / requireLocationSlot ──────────────────

  describe("canAddLocation", () => {
    it("allows adding when under limit (basic: 1 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockLocationCount.mockResolvedValue(0);

      expect(await canAddLocation("ws-1")).toBe(true);
    });

    it("blocks when at limit (basic: 1 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockLocationCount.mockResolvedValue(1);

      expect(await canAddLocation("ws-1")).toBe(false);
    });

    it("allows for professional plan (5 locations)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
      });

      expect(await canAddLocation("ws-1")).toBe(true);
    });
  });

  describe("requireLocationSlot", () => {
    it("returns 403 when at location limit", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BASIC",
        status: "ACTIVE",
      });
      mockLocationCount.mockResolvedValue(1);

      const result = await requireLocationSlot("ws-1");
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);

      const body = await result!.json();
      expect(body.error).toBe("PLAN_LIMIT");
      expect(body.feature).toBe("maxLocations");
    });
  });

  // ─── Plan Configuration Sanity Checks ─────────────────────

  describe("PLANS config", () => {
    it("basic has restrictive limits", () => {
      const b = PLANS.basic;
      expect(b.limits.maxEmployees).toBe(10);
      expect(b.limits.maxLocations).toBe(1);
      expect(b.limits.datevExport).toBe(false);
      expect(b.limits.apiWebhooks).toBe(false);
      expect(b.limits.customRoles).toBe(false);
      expect(b.limits.analytics).toBe(false);
    });

    it("professional unlocks datev, webhooks, roles, analytics", () => {
      const p = PLANS.professional;
      expect(p.limits.maxEmployees).toBe(50);
      expect(p.limits.maxLocations).toBe(5);
      expect(p.limits.datevExport).toBe(true);
      expect(p.limits.apiWebhooks).toBe(true);
      expect(p.limits.customRoles).toBe(true);
      expect(p.limits.analytics).toBe(true);
      // But NOT SSO/SLA
      expect(p.limits.ssoSaml).toBe(false);
      expect(p.limits.dedicatedSla).toBe(false);
    });

    it("enterprise has everything", () => {
      const e = PLANS.enterprise;
      expect(e.limits.ssoSaml).toBe(true);
      expect(e.limits.dedicatedSla).toBe(true);
      expect(e.limits.customIntegrations).toBe(true);
    });

    it("all plans have unique prismaKeys", () => {
      const keys = Object.values(PLANS).map((p) => p.prismaKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
