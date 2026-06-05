/**
 * @vitest-environment node
 *
 * Tests for GET /api/billing/invoices  +  GET /api/billing/trial-status
 *
 * billing/invoices: OWNER/ADMIN only (settings:read). Returns invoice list.
 * billing/trial-status: any authenticated user. Returns trial countdown.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockInvoiceFindMany, mockGetSubscription } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockInvoiceFindMany: vi.fn(),
    mockGetSubscription: vi.fn(),
  }),
);

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
vi.mock("@/lib/db", () => ({
  prisma: { invoice: { findMany: mockInvoiceFindMany } },
}));
vi.mock("@/lib/subscription", () => ({ getSubscription: mockGetSubscription }));
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
};
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };
const emp: SessionUser = {
  ...admin,
  id: "u3",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

describe("GET /api/billing/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockInvoiceFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/billing/invoices/route");
    const res = await GET(new Request("http://localhost/api/billing/invoices"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls (settings:read is OWNER/ADMIN)", async () => {
    mockSession.user = manager;
    const { GET } = await import("@/app/api/billing/invoices/route");
    const res = await GET(new Request("http://localhost/api/billing/invoices"));
    expect(res.status).toBe(403);
  });

  it("returns empty invoices array when none exist", async () => {
    mockSession.user = admin;
    mockInvoiceFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/billing/invoices/route");
    const res = await GET(new Request("http://localhost/api/billing/invoices"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices).toEqual([]);
  });

  it("returns invoice list for ADMIN", async () => {
    mockSession.user = admin;
    const invoices = [
      {
        id: "inv1",
        invoiceNumber: "2026-001",
        issuedAt: new Date(),
        amount: 5900,
        vatAmount: 941,
        currency: "EUR",
        pdfUrl: null,
        hostedUrl: null,
      },
    ];
    mockInvoiceFindMany.mockResolvedValue(invoices);
    const { GET } = await import("@/app/api/billing/invoices/route");
    const res = await GET(new Request("http://localhost/api/billing/invoices"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0].invoiceNumber).toBe("2026-001");
  });
});

describe("GET /api/billing/trial-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/billing/trial-status/route");
    const res = await GET(
      new Request("http://localhost/api/billing/trial-status"),
    );
    expect(res.status).toBe(401);
  });

  it("returns isTrialing:false when not on trial", async () => {
    mockSession.user = admin;
    mockGetSubscription.mockResolvedValue({ status: "ACTIVE", trialEnd: null });
    const { GET } = await import("@/app/api/billing/trial-status/route");
    const res = await GET(
      new Request("http://localhost/api/billing/trial-status"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isTrialing).toBe(false);
    expect(body.daysLeft).toBe(0);
  });

  it("returns daysLeft > 0 when actively trialing", async () => {
    mockSession.user = emp;
    const trialEnd = new Date(Date.now() + 7 * 86400000); // 7 days from now
    mockGetSubscription.mockResolvedValue({ status: "TRIALING", trialEnd });
    const { GET } = await import("@/app/api/billing/trial-status/route");
    const res = await GET(
      new Request("http://localhost/api/billing/trial-status"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isTrialing).toBe(true);
    expect(body.daysLeft).toBeGreaterThan(0);
    expect(body.daysLeft).toBeLessThanOrEqual(7);
  });

  it("returns isPastDue:true when subscription is past due", async () => {
    mockSession.user = admin;
    mockGetSubscription.mockResolvedValue({
      status: "PAST_DUE",
      trialEnd: null,
    });
    const { GET } = await import("@/app/api/billing/trial-status/route");
    const res = await GET(
      new Request("http://localhost/api/billing/trial-status"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPastDue).toBe(true);
    expect(body.isTrialing).toBe(false);
  });
});
