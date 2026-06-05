/**
 * @vitest-environment node
 *
 * Tests for GET / PUT /api/billing/customer-info
 *
 * OWNER/ADMIN only. Returns / upserts billing contact details.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindUnique, mockUpsert, mockSendEmail } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockFindUnique: vi.fn(),
    mockUpsert: vi.fn(),
    mockSendEmail: vi.fn().mockResolvedValue({ status: "sent" }),
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
  prisma: {
    workspaceCustomer: { findUnique: mockFindUnique, upsert: mockUpsert },
  },
}));
vi.mock("@/lib/billing-audit-email", () => ({
  sendMonthlyBillingEmail: mockSendEmail,
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
};
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };

const customerRecord = {
  workspaceId: "ws1",
  companyName: "Test GmbH",
  billingEmail: "billing@test.com",
  vatId: "DE123456789",
  billingAddress: null,
  billingCity: null,
  billingPostalCode: null,
  billingCountry: "DE",
};

describe("GET /api/billing/customer-info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/billing/customer-info/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls", async () => {
    mockSession.user = manager;
    const { GET } = await import("@/app/api/billing/customer-info/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns empty object when no record exists", async () => {
    mockSession.user = admin;
    mockFindUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/billing/customer-info/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("returns customer record for ADMIN", async () => {
    mockSession.user = admin;
    mockFindUnique.mockResolvedValue(customerRecord);
    const { GET } = await import("@/app/api/billing/customer-info/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.companyName).toBe("Test GmbH");
  });
});

describe("PUT /api/billing/customer-info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PUT } = await import("@/app/api/billing/customer-info/route");
    const res = await PUT(
      new Request("http://localhost/api/billing/customer-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: "Test" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls", async () => {
    mockSession.user = manager;
    const { PUT } = await import("@/app/api/billing/customer-info/route");
    const res = await PUT(
      new Request("http://localhost/api/billing/customer-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: "Test" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 422 when billingEmail is invalid", async () => {
    mockSession.user = admin;
    const { PUT } = await import("@/app/api/billing/customer-info/route");
    const res = await PUT(
      new Request("http://localhost/api/billing/customer-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingEmail: "not-an-email" }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("upserts record and returns it", async () => {
    mockSession.user = admin;
    mockUpsert.mockResolvedValue(customerRecord);
    const { PUT } = await import("@/app/api/billing/customer-info/route");
    const res = await PUT(
      new Request("http://localhost/api/billing/customer-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: "Test GmbH",
          billingEmail: "billing@test.com",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.companyName).toBe("Test GmbH");
    expect(mockUpsert).toHaveBeenCalled();
  });
});
