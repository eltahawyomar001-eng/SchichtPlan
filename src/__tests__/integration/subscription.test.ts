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
    it("returns STARTER plan when no subscription exists", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("starter");
    });

    it("returns STARTER when subscription is CANCELED", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "CANCELED",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("starter");
    });

    it("returns correct plan for ACTIVE subscription", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "ACTIVE",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("business");
    });

    it("returns correct plan for TRIALING subscription", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "TEAM",
        status: "TRIALING",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("team");
    });

    it("falls back to STARTER for PAST_DUE status", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "PAST_DUE",
      });
      const plan = await getWorkspacePlan("ws-1");
      expect(plan.id).toBe("starter");
    });
  });

  // ─── canUseFeature ─────────────────────────────────────────

  describe("canUseFeature", () => {
    it("starter cannot use datevExport", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      expect(await canUseFeature("ws-1", "datevExport")).toBe(false);
    });

    it("starter cannot use customRoles", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      expect(await canUseFeature("ws-1", "customRoles")).toBe(false);
    });

    it("business can use datevExport", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "datevExport")).toBe(true);
    });

    it("business can use customRoles", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "customRoles")).toBe(true);
    });

    it("team can use absenceManagement", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "TEAM",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "absenceManagement")).toBe(true);
    });

    it("team cannot use apiWebhooks", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "TEAM",
        status: "ACTIVE",
      });
      expect(await canUseFeature("ws-1", "apiWebhooks")).toBe(false);
    });
  });

  // ─── requirePlanFeature (server-side guard) ────────────────

  describe("requirePlanFeature", () => {
    it("returns null when feature is allowed", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "ACTIVE",
      });
      const result = await requirePlanFeature("ws-1", "datevExport");
      expect(result).toBeNull();
    });

    it("returns 403 with PLAN_LIMIT error when feature is gated", async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null); // starter
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
    it("allows adding when under the limit (starter: 5 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "STARTER",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(3);

      expect(await canAddEmployee("ws-1")).toBe(true);
    });

    it("blocks when at the limit (starter: 5 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "STARTER",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(5);

      expect(await canAddEmployee("ws-1")).toBe(false);
    });

    it("always allows for plans with Infinity limit", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "TEAM",
        status: "ACTIVE",
      });
      // Don't even need to mock count — should short-circuit

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
        plan: "STARTER",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(2);

      expect(await requireEmployeeSlot("ws-1")).toBeNull();
    });

    it("returns 403 when at limit", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "STARTER",
        status: "ACTIVE",
      });
      mockEmployeeCount.mockResolvedValue(5);

      const result = await requireEmployeeSlot("ws-1");
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);

      const body = await result!.json();
      expect(body.error).toBe("PLAN_LIMIT");
      expect(body.feature).toBe("maxEmployees");
      expect(body.limit).toBe(5);
    });
  });

  // ─── canAddLocation / requireLocationSlot ──────────────────

  describe("canAddLocation", () => {
    it("allows adding when under limit (starter: 1 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "STARTER",
        status: "ACTIVE",
      });
      mockLocationCount.mockResolvedValue(0);

      expect(await canAddLocation("ws-1")).toBe(true);
    });

    it("blocks when at limit (starter: 1 max)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "STARTER",
        status: "ACTIVE",
      });
      mockLocationCount.mockResolvedValue(1);

      expect(await canAddLocation("ws-1")).toBe(false);
    });

    it("allows for business plan (Infinity)", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "BUSINESS",
        status: "ACTIVE",
      });

      expect(await canAddLocation("ws-1")).toBe(true);
    });
  });

  describe("requireLocationSlot", () => {
    it("returns 403 when at location limit", async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        plan: "STARTER",
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
    it("starter has the most restrictive limits", () => {
      const s = PLANS.starter;
      expect(s.limits.maxEmployees).toBe(5);
      expect(s.limits.maxLocations).toBe(1);
      expect(s.limits.datevExport).toBe(false);
      expect(s.limits.apiWebhooks).toBe(false);
      expect(s.limits.customRoles).toBe(false);
      expect(s.limits.analytics).toBe(false);
    });

    it("team unlocks templates and absence management", () => {
      const t = PLANS.team;
      expect(t.limits.maxEmployees).toBe(Infinity);
      expect(t.limits.shiftTemplates).toBe(true);
      expect(t.limits.absenceManagement).toBe(true);
      expect(t.limits.csvPdfExport).toBe(true);
      // But NOT datev, webhooks, roles
      expect(t.limits.datevExport).toBe(false);
      expect(t.limits.apiWebhooks).toBe(false);
      expect(t.limits.customRoles).toBe(false);
    });

    it("business unlocks datev, webhooks, roles, analytics", () => {
      const b = PLANS.business;
      expect(b.limits.datevExport).toBe(true);
      expect(b.limits.apiWebhooks).toBe(true);
      expect(b.limits.customRoles).toBe(true);
      expect(b.limits.analytics).toBe(true);
      // But NOT SSO/SLA
      expect(b.limits.ssoSaml).toBe(false);
      expect(b.limits.dedicatedSla).toBe(false);
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
