/**
 * @vitest-environment node
 *
 * Tests for POST /api/billing/upgrade
 *
 * Settings:update permission required (OWNER/ADMIN).
 * Tests cover auth, permission, invalid plan, enterprise rejection,
 * no subscription found, and simulation-mode upgrade.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockGetSubscription,
  mockSimulate,
  mockSyncUsage,
  mockIsSimulation,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockGetSubscription: vi.fn(),
  mockSimulate: vi.fn().mockResolvedValue(undefined),
  mockSyncUsage: vi.fn().mockResolvedValue(undefined),
  mockIsSimulation: vi.fn().mockReturnValue(true), // use simulation mode to avoid Stripe calls
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/db", () => ({ prisma: { subscription: { update: vi.fn() } } }));
vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async () => {
      if (!mockSession.user) {
        const { NextResponse } = await import("next/server");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          ),
        };
      }
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId,
      };
    }),
  };
});
vi.mock("@/lib/subscription", () => ({
  getSubscription: mockGetSubscription,
  updateSubscriptionFromStripe: vi.fn(),
  isSimulationMode: mockIsSimulation,
  simulateSubscription: mockSimulate,
  linkSubscriptionByCustomer: vi.fn(),
  getWorkspacePlan: vi.fn(),
}));
vi.mock("@/lib/subscription-guard", () => ({
  syncUsageLimits: mockSyncUsage,
  ensureWorkspaceUsage: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  getPlanByPriceId: vi.fn(),
  PLANS: {
    basic: {
      prismaKey: "BASIC",
      stripePriceIdMonthly: "price_basic_mo",
      stripePriceIdAnnual: "price_basic_yr",
      perUserMonthly: 999,
      perUserAnnual: 799,
    },
    professional: {
      prismaKey: "PROFESSIONAL",
      stripePriceIdMonthly: "price_pro_mo",
      stripePriceIdAnnual: "price_pro_yr",
      perUserMonthly: 1999,
      perUserAnnual: 1599,
    },
    enterprise: {
      prismaKey: "ENTERPRISE",
      stripePriceIdMonthly: null,
      stripePriceIdAnnual: null,
      perUserMonthly: 0,
      perUserAnnual: 0,
    },
  },
}));
vi.mock("@/lib/ticketing-addon", () => ({
  getTicketingTierByPriceId: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/schichtplanung-addon", () => ({
  getSchichtplanungBillingByPriceId: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    withRequestId: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const admin: SessionUser = {
  id: "u1",
  email: "admin@test.com",
  workspaceId: "ws1",
  role: "ADMIN",
  employeeId: null,
  name: "Admin",
  subscriptionStatus: "ACTIVE",
  planId: "basic",
  trialEndsAt: null,
};
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };

function makeReq(body: object) {
  return new Request("http://localhost/api/billing/upgrade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const activeSub = {
  plan: "BASIC",
  status: "ACTIVE",
  stripeSubscriptionId: "sub_123",
  stripeCustomerId: "cus_123",
  seatCount: 5,
};

describe("POST /api/billing/upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockIsSimulation.mockReturnValue(true);
    mockGetSubscription.mockResolvedValue(activeSub);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/billing/upgrade/route");
    const res = await POST(
      makeReq({ plan: "professional", billingCycle: "monthly" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls (settings:update is OWNER/ADMIN)", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/billing/upgrade/route");
    const res = await POST(
      makeReq({ plan: "professional", billingCycle: "monthly" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when plan is invalid", async () => {
    mockSession.user = admin;
    const { POST } = await import("@/app/api/billing/upgrade/route");
    const res = await POST(
      makeReq({ plan: "unicorn", billingCycle: "monthly" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 422 when upgrading to enterprise (contact sales)", async () => {
    mockSession.user = admin;
    const { POST } = await import("@/app/api/billing/upgrade/route");
    const res = await POST(
      makeReq({ plan: "enterprise", billingCycle: "monthly" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("ENTERPRISE_CONTACT_SALES");
  });

  it("returns 404 when no subscription exists", async () => {
    mockSession.user = admin;
    mockGetSubscription.mockResolvedValue(null);
    const { POST } = await import("@/app/api/billing/upgrade/route");
    const res = await POST(
      makeReq({ plan: "professional", billingCycle: "monthly" }),
    );
    expect(res.status).toBe(404);
  });

  it("upgrades plan in simulation mode and returns new plan", async () => {
    mockSession.user = admin;
    const upgradedSub = { ...activeSub, plan: "PROFESSIONAL" };
    mockGetSubscription
      .mockResolvedValueOnce(activeSub) // initial check
      .mockResolvedValueOnce(upgradedSub); // post-upgrade fetch
    mockSimulate.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/billing/upgrade/route");
    const res = await POST(
      makeReq({ plan: "professional", billingCycle: "monthly" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.simulation).toBe(true);
    expect(body.plan).toBe("PROFESSIONAL");
    expect(mockSimulate).toHaveBeenCalledWith({
      workspaceId: "ws1",
      plan: "professional",
      billingCycle: "monthly",
    });
  });
});
