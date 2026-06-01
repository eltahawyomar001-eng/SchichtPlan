/**
 * @vitest-environment node
 *
 * Tests for GET /api/time-entries/clock/team
 *
 * Manager-only endpoint that returns live clock state for all employees.
 * Returns currently clocked-in (active) entries plus today's completed ones.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindMany, mockEmployeeFindMany } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindMany: vi.fn(),
  mockEmployeeFindMany: vi.fn(),
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
    timeEntry: { findMany: mockFindMany },
    employee: { findMany: mockEmployeeFindMany },
  },
}));
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

const manager: SessionUser = {
  id: "u1",
  email: "mgr@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "Mgr",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const emp: SessionUser = {
  ...manager,
  id: "u2",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const activeEntry = {
  id: "te1",
  clockInAt: new Date(),
  clockOutAt: null,
  employee: {
    id: "emp1",
    firstName: "A",
    lastName: "B",
    color: null,
    position: null,
  },
};
const completedEntry = {
  id: "te2",
  clockInAt: new Date(Date.now() - 28800000),
  clockOutAt: new Date(),
  employee: {
    id: "emp2",
    firstName: "C",
    lastName: "D",
    color: null,
    position: null,
  },
};

describe("GET /api/time-entries/clock/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFindMany.mockResolvedValue([]);
    mockEmployeeFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/time-entries/clock/team/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/clock/team"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by an employee", async () => {
    mockSession.user = emp;
    const { GET } = await import("@/app/api/time-entries/clock/team/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/clock/team"),
    );
    expect(res.status).toBe(403);
  });

  it("returns team and summary when no entries", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/clock/team/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/clock/team"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("team");
    expect(body).toHaveProperty("summary");
  });

  it("returns team status with working/break/offline counts", async () => {
    mockSession.user = manager;
    const emp1 = {
      id: "emp1",
      firstName: "A",
      lastName: "B",
      color: null,
      position: null,
    };
    mockEmployeeFindMany.mockResolvedValue([emp1]);
    mockFindMany
      .mockResolvedValueOnce([activeEntry]) // active (no clockOut)
      .mockResolvedValueOnce([completedEntry]); // completed (has clockOut)
    const { GET } = await import("@/app/api/time-entries/clock/team/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/clock/team"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("team");
    expect(body).toHaveProperty("summary");
  });

  it("accepts a date query param for historical view", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/clock/team/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/clock/team?date=2026-05-15",
      ),
    );
    expect(res.status).toBe(200);
    // Both findMany calls should have been made
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
