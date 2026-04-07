/**
 * Tests for /api/billing/checkout (POST), /api/billing/portal (POST),
 * /api/billing/subscription (GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    workspace: { findUnique: vi.fn() },
  },
}));

const mockStripe = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));

const mockSubscription = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  ensureSubscription: vi.fn(),
  isSimulationMode: vi.fn(() => false),
  simulateSubscription: vi.fn(),
  requirePlanFeature: vi.fn(() => null),
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
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockStripe,
  getPlanByPriceId: vi.fn(() => ({ trialDays: 14 })),
  PLANS: {
    basic: {
      limits: { employees: 5 },
      stripePriceIdMonthly: "price_m",
      stripePriceIdAnnual: "price_a",
    },
    professional: {
      limits: { employees: 25 },
      stripePriceIdMonthly: "price_pm",
      stripePriceIdAnnual: "price_pa",
    },
    enterprise: {
      limits: { employees: -1 },
      stripePriceIdMonthly: "price_em",
      stripePriceIdAnnual: "price_ea",
    },
  },
}));
vi.mock("@/lib/subscription", () => mockSubscription);
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => null),
  cacheIdempotentResponse: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

// ── /api/billing/checkout ──
describe("POST /api/billing/checkout", () => {
  let handler: typeof import("@/app/api/billing/checkout/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/billing/checkout/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "professional", billingCycle: "monthly" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid plan", async () => {
    mockSession.user = buildOwner();
    const req = new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "nonexistent", billingCycle: "monthly" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(400);
  });

  it("uses simulation mode when configured", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockSubscription.isSimulationMode.mockReturnValue(true);
    mockSubscription.simulateSubscription.mockResolvedValue(undefined);

    const req = new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "professional", billingCycle: "monthly" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.simulation).toBe(true);
    expect(body.url).toContain("billing=success");
    expect(mockSubscription.simulateSubscription).toHaveBeenCalledWith({
      workspaceId: owner.workspaceId,
      plan: "professional",
      billingCycle: "monthly",
    });
  });
});

// ── /api/billing/portal ──
describe("POST /api/billing/portal", () => {
  let handler: typeof import("@/app/api/billing/portal/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/billing/portal/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE without settings permission", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(403);
  });

  it("returns simulation URL in simulation mode", async () => {
    mockSession.user = buildOwner();
    mockSubscription.isSimulationMode.mockReturnValue(true);
    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.simulation).toBe(true);
  });

  it("returns 404 when no stripe customer", async () => {
    mockSession.user = buildOwner();
    mockSubscription.isSimulationMode.mockReturnValue(false);
    mockSubscription.getSubscription.mockResolvedValue(null);
    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(404);
  });
});

// ── /api/billing/subscription ──
describe("GET /api/billing/subscription", () => {
  let handler: typeof import("@/app/api/billing/subscription/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/billing/subscription/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost"));
    expect(res.status).toBe(401);
  });

  it("returns subscription info", async () => {
    mockSession.user = buildOwner();
    mockSubscription.getSubscription.mockResolvedValue({
      plan: "BASIC",
      status: "ACTIVE",
      seatCount: 1,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      stripeSubscriptionId: null,
    });

    const res = await handler.GET(new Request("http://localhost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("BASIC");
    expect(body.limits).toBeDefined();
  });

  it("auto-creates subscription if none exists", async () => {
    mockSession.user = buildOwner();
    mockSubscription.getSubscription.mockResolvedValue(null);
    mockSubscription.ensureSubscription.mockResolvedValue({
      plan: "BASIC",
      status: "ACTIVE",
      seatCount: 1,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      stripeSubscriptionId: null,
    });

    const res = await handler.GET(new Request("http://localhost"));
    expect(res.status).toBe(200);
    expect(mockSubscription.ensureSubscription).toHaveBeenCalled();
  });
});
