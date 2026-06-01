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
  mockEmployeeFindMany,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockBalanceFindMany: vi.fn(),
  mockBalanceUpsert: vi.fn(),
  mockBalanceCount: vi.fn().mockResolvedValue(0),
  mockEmployeeFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
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
      if (!mockSession.user.workspaceId) {
        const { NextResponse } = await import("next/server");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "No workspace" },
            { status: 400 },
          ),
        };
      }
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId as string,
      };
    }),
  };
});

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
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "bal-1" }),
      update: vi.fn().mockResolvedValue({ id: "bal-1" }),
    },
    employee: {
      findMany: mockEmployeeFindMany,
      findFirst: vi.fn().mockResolvedValue(null),
    },
    absenceRequest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withRequestId: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
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
    const admin = buildAdmin();
    mockSession.user = admin;
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "emp-1",
        firstName: "Max",
        lastName: "Mustermann",
        workDaysPerWeek: 5,
        contractType: "FULL_TIME",
      },
    ]);
    mockBalanceFindMany.mockResolvedValue([
      {
        id: "vb1",
        employeeId: "emp-1",
        year: new Date().getFullYear(),
        totalEntitlement: 30,
        carryOver: 0,
        adjustments: 0,
      },
    ]);

    const res = await handler.GET(
      new Request("http://localhost/api/vacation-balances"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Route returns a plain array
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].legalMinimum).toBeDefined();
  });

  it("EMPLOYEE only sees own balance", async () => {
    const emp = buildEmployee({ employeeId: "emp-1" });
    mockSession.user = emp;
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "emp-1",
        firstName: "Max",
        lastName: "M",
        workDaysPerWeek: 5,
        contractType: "FULL_TIME",
      },
    ]);
    mockBalanceFindMany.mockResolvedValue([]);

    await handler.GET(new Request("http://localhost/api/vacation-balances"));
    const empCall = mockEmployeeFindMany.mock.calls[0][0];
    expect(empCall.where.id).toBe("emp-1");
  });

  it("supports year query param", async () => {
    mockSession.user = buildAdmin();
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "emp-1",
        firstName: "Max",
        lastName: "M",
        workDaysPerWeek: 5,
        contractType: "FULL_TIME",
      },
    ]);
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
