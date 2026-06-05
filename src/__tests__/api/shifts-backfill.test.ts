/**
 * @vitest-environment node
 *
 * Tests for POST /api/shifts/backfill
 *
 * Finds replacement candidates for a single shift.
 * Requires shifts:update + Schichtplanung addon + autoScheduling plan feature.
 * Body: { shiftId, maxCandidates? }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockShiftFindFirst,
  mockWorkspaceFindUnique,
  mockRunBackfill,
  mockAddon,
  mockPlanGate,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockShiftFindFirst: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRunBackfill: vi.fn(),
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
    shift: { findFirst: mockShiftFindFirst },
    workspace: { findUnique: mockWorkspaceFindUnique },
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
vi.mock("@/lib/auto-scheduler", () => ({ runBackfill: mockRunBackfill }));
vi.mock("@/lib/schichtplanung-addon", () => ({
  requireSchichtplanungAddon: mockAddon,
}));
vi.mock("@/lib/subscription", () => ({ requirePlanFeature: mockPlanGate }));
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

function makeReq(body: object) {
  return new Request("http://localhost/api/shifts/backfill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const shift = {
  id: "s1",
  workspaceId: "ws1",
  date: new Date("2026-07-01"),
  startTime: "08:00",
  endTime: "16:00",
  status: "OPEN",
};

describe("POST /api/shifts/backfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockAddon.mockResolvedValue(null);
    mockPlanGate.mockResolvedValue(null);
    mockShiftFindFirst.mockResolvedValue(shift);
    mockWorkspaceFindUnique.mockResolvedValue({ bundesland: "BY" });
    mockRunBackfill.mockResolvedValue({ candidates: [], totalCandidates: 0 });
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/shifts/backfill/route");
    const res = await POST(makeReq({ shiftId: "s1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { POST } = await import("@/app/api/shifts/backfill/route");
    const res = await POST(makeReq({ shiftId: "s1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when shiftId is missing", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/shifts/backfill/route");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when shift not found", async () => {
    mockSession.user = manager;
    mockShiftFindFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/shifts/backfill/route");
    const res = await POST(makeReq({ shiftId: "s99" }));
    expect(res.status).toBe(404);
  });

  it("returns ranked candidates for a valid shift", async () => {
    mockSession.user = manager;
    mockRunBackfill.mockResolvedValue({
      candidates: [{ employeeId: "emp1", score: 95 }],
      totalCandidates: 1,
    });
    const { POST } = await import("@/app/api/shifts/backfill/route");
    const res = await POST(makeReq({ shiftId: "s1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(mockRunBackfill).toHaveBeenCalledWith(
      expect.objectContaining({ shiftId: "s1", workspaceId: "ws1" }),
    );
  });
});
