/**
 * @vitest-environment node
 *
 * Tests for POST /api/shifts/[id]/claim
 *
 * Employees can self-assign open (OPEN, no employeeId) shifts.
 * Covers: auth, missing employee profile, shift not found,
 * already claimed, shift conflict, and happy path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockShiftFindFirst,
  mockShiftUpdate,
  mockCheckConflicts,
  mockAddonRequired,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockShiftFindFirst: vi.fn(),
  mockShiftUpdate: vi.fn(),
  mockCheckConflicts: vi.fn(),
  mockAddonRequired: vi.fn().mockResolvedValue(null),
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
    shift: {
      findFirst: mockShiftFindFirst,
      update: mockShiftUpdate,
    },
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
vi.mock("@/lib/automations", () => ({
  checkShiftConflicts: mockCheckConflicts,
  ARBZG_MAX_DAILY_MINUTES: 600,
}));
vi.mock("@/lib/schichtplanung-addon", () => ({
  requireSchichtplanungAddon: mockAddonRequired,
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

const employeeUser: SessionUser = {
  id: "u1",
  email: "emp@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "emp1",
  name: "Emp",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

const noProfileUser: SessionUser = {
  ...employeeUser,
  employeeId: null,
};

const openShift = {
  id: "s1",
  workspaceId: "ws1",
  employeeId: null,
  status: "OPEN",
  date: new Date("2026-06-10"),
  startTime: "08:00",
  endTime: "16:00",
};

const makeCtx = (id = "s1") => ({
  params: Promise.resolve({ id }),
});

describe("POST /api/shifts/[id]/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockAddonRequired.mockResolvedValue(null);
    mockCheckConflicts.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s1/claim", { method: "POST" }),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when user has no linked employee profile", async () => {
    mockSession.user = noProfileUser;
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s1/claim", { method: "POST" }),
      makeCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when shift does not exist", async () => {
    mockSession.user = employeeUser;
    mockShiftFindFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s99/claim", { method: "POST" }),
      makeCtx("s99"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when shift is already assigned to an employee", async () => {
    mockSession.user = employeeUser;
    mockShiftFindFirst.mockResolvedValue({ ...openShift, employeeId: "emp2" });
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s1/claim", { method: "POST" }),
      makeCtx(),
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when shift has a non-OPEN status", async () => {
    mockSession.user = employeeUser;
    mockShiftFindFirst.mockResolvedValue({
      ...openShift,
      status: "SCHEDULED",
      employeeId: null,
    });
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s1/claim", { method: "POST" }),
      makeCtx(),
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when a conflict exists with another shift", async () => {
    mockSession.user = employeeUser;
    mockShiftFindFirst.mockResolvedValue(openShift);
    mockCheckConflicts.mockResolvedValue([
      { id: "s2", startTime: "07:00", endTime: "09:00" },
    ]);
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s1/claim", { method: "POST" }),
      makeCtx(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.conflicts).toHaveLength(1);
  });

  it("claims an open shift and returns the updated shift", async () => {
    mockSession.user = employeeUser;
    mockShiftFindFirst.mockResolvedValue(openShift);
    mockCheckConflicts.mockResolvedValue([]);
    const claimedShift = {
      ...openShift,
      employeeId: "emp1",
      status: "SCHEDULED",
    };
    mockShiftUpdate.mockResolvedValue(claimedShift);
    const { POST } = await import("@/app/api/shifts/[id]/claim/route");
    const res = await POST(
      new Request("http://localhost/api/shifts/s1/claim", { method: "POST" }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employeeId).toBe("emp1");
    expect(body.status).toBe("SCHEDULED");
    expect(mockShiftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: "emp1",
          status: "SCHEDULED",
        }),
      }),
    );
  });
});
