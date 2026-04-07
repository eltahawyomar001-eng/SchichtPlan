/**
 * @vitest-environment node
 *
 * Tests for Vacation Balances API:
 *   GET  /api/vacation-balances — list vacation balances
 *   POST /api/vacation-balances — create/update vacation balance
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockBalanceFindMany,
  mockBalanceUpsert,
  mockBalanceCount,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockBalanceFindMany: vi.fn(),
  mockBalanceUpsert: vi.fn(),
  mockBalanceCount: vi.fn().mockResolvedValue(0),
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
vi.mock("@/lib/db", () => ({
  prisma: {
    vacationBalance: {
      findMany: mockBalanceFindMany,
      upsert: mockBalanceUpsert,
      count: mockBalanceCount,
    },
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/vacation-balances", () => {
  let handler: typeof import("@/app/api/vacation-balances/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/vacation-balances/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/vacation-balances"),
    );
    expect(res.status).toBe(401);
  });

  it("returns balances for admin", async () => {
    mockSession.user = buildAdmin();
    mockBalanceFindMany.mockResolvedValue([
      {
        id: "vb1",
        year: 2025,
        totalEntitlement: 30,
        employee: { workDaysPerWeek: 5 },
      },
    ]);
    mockBalanceCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/vacation-balances"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    // Should include legal minimum
    expect(body.data[0].legalMinimum).toBe(20);
  });

  it("EMPLOYEE only sees own balance", async () => {
    mockSession.user = buildEmployee({ employeeId: "emp-1" });
    mockBalanceFindMany.mockResolvedValue([]);

    await handler.GET(new Request("http://localhost/api/vacation-balances"));
    const call = mockBalanceFindMany.mock.calls[0][0];
    expect(call.where.employeeId).toBe("emp-1");
  });

  it("supports year query param", async () => {
    mockSession.user = buildAdmin();
    mockBalanceFindMany.mockResolvedValue([]);

    await handler.GET(
      new Request("http://localhost/api/vacation-balances?year=2024"),
    );
    const call = mockBalanceFindMany.mock.calls[0][0];
    expect(call.where.year).toBe(2024);
  });
});

describe("POST /api/vacation-balances", () => {
  let handler: typeof import("@/app/api/vacation-balances/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/vacation-balances/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      new Request("http://localhost/api/vacation-balances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-1",
          year: 2025,
          totalEntitlement: 30,
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(
      new Request("http://localhost/api/vacation-balances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-1",
          year: 2025,
          totalEntitlement: 30,
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
