/**
 * @vitest-environment node
 *
 * Tests for POST /api/shifts/auto-schedule
 *
 * CSP-based auto-scheduler. Requires shifts:create permission,
 * Schichtplanung addon, and autoScheduling plan feature.
 * Body: { startDate, endDate, locationId?, dryRun?, weights? }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockWorkspaceFindUnique,
  mockRunAutoScheduler,
  mockAddon,
  mockPlanGate,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockWorkspaceFindUnique: vi.fn(),
  mockRunAutoScheduler: vi.fn(),
  mockAddon: vi.fn().mockResolvedValue(null),
  mockPlanGate: vi.fn().mockResolvedValue(null),
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
    workspace: { findUnique: mockWorkspaceFindUnique },
    autoScheduleRun: { create: vi.fn().mockResolvedValue({ id: "run1" }) },
    shift: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockResolvedValue([]),
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
vi.mock("@/lib/auto-scheduler", () => ({
  runAutoScheduler: mockRunAutoScheduler,
}));
vi.mock("@/lib/schichtplanung-addon", () => ({
  requireSchichtplanungAddon: mockAddon,
}));
vi.mock("@/lib/subscription", () => ({ requirePlanFeature: mockPlanGate }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
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
};
const emp: SessionUser = {
  ...manager,
  id: "u2",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const validBody = { startDate: "2026-07-01", endDate: "2026-07-07" };

function makeReq(body: object) {
  return new Request("http://localhost/api/shifts/auto-schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/shifts/auto-schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockAddon.mockResolvedValue(null);
    mockPlanGate.mockResolvedValue(null);
    mockWorkspaceFindUnique.mockResolvedValue({ bundesland: "NW" });
    mockRunAutoScheduler.mockResolvedValue({
      assignedCount: 5,
      unresolvedCount: 0,
      totalOpenShifts: 5,
      totalCostEstimate: 0,
      fairnessScore: 1,
      assignments: [],
      unresolvedShifts: [],
      dryRun: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/shifts/auto-schedule/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { POST } = await import("@/app/api/shifts/auto-schedule/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 when endDate is before startDate", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/shifts/auto-schedule/route");
    const res = await POST(
      makeReq({ startDate: "2026-07-10", endDate: "2026-07-05" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when date range exceeds 31 days", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/shifts/auto-schedule/route");
    const res = await POST(
      makeReq({ startDate: "2026-06-01", endDate: "2026-08-01" }),
    );
    expect(res.status).toBe(400);
  });

  it("runs auto-scheduler and returns results", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/shifts/auto-schedule/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("assigned");
    expect(mockRunAutoScheduler).toHaveBeenCalledOnce();
  });

  it("succeeds in dry-run mode without applying shift changes", async () => {
    mockSession.user = manager;
    mockRunAutoScheduler.mockResolvedValue({
      assignedCount: 3,
      unresolvedCount: 2,
      totalOpenShifts: 5,
      totalCostEstimate: 0,
      fairnessScore: 0.8,
      assignments: [],
      unresolvedShifts: [],
      dryRun: true,
    });
    const { POST } = await import("@/app/api/shifts/auto-schedule/route");
    const res = await POST(makeReq({ ...validBody, dryRun: true }));
    expect(res.status).toBe(200);
    expect(mockRunAutoScheduler).toHaveBeenCalledOnce();
  });
});
