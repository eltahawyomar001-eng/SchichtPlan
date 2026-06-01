/**
 * @vitest-environment node
 *
 * Tests for PATCH /api/shift-change-requests/[id]
 *
 * Actions: cancel (employee), reject (manager), approve (manager)
 * Uses compare-and-swap updateMany to prevent double-processing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockFindFirst,
  mockUpdateMany,
  mockFindAfter,
  mockTransaction,
  mockEmployeeFindFirst,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindFirst: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindAfter: vi.fn(),
  mockTransaction: vi.fn(),
  mockEmployeeFindFirst: vi.fn(),
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

let findFirstCallCount = 0;
vi.mock("@/lib/db", () => ({
  prisma: {
    shiftChangeRequest: {
      findFirst: vi.fn((...args) => {
        findFirstCallCount++;
        if (findFirstCallCount > 1) return mockFindAfter(...args);
        return mockFindFirst(...args);
      }),
      updateMany: mockUpdateMany,
    },
    employee: { findFirst: mockEmployeeFindFirst },
    shift: { update: vi.fn().mockResolvedValue({}) },
    $transaction: mockTransaction,
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
  checkShiftConflicts: vi.fn().mockResolvedValue([]),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/e-signature", () => ({
  createESignature: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
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

const manager: SessionUser = {
  id: "u1",
  email: "mgr@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "Manager",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const empUser: SessionUser = {
  id: "u2",
  email: "emp@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "emp1",
  name: "Emp",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

const pendingRequest = {
  id: "cr1",
  workspaceId: "ws1",
  status: "AUSSTEHEND",
  requesterId: "emp1",
  shiftId: "s1",
  newDate: null,
  newStartTime: "09:00",
  newEndTime: "17:00",
  newNotes: null,
  shift: {
    id: "s1",
    date: new Date("2026-07-01"),
    startTime: "08:00",
    endTime: "16:00",
    employeeId: "emp1",
  },
  requester: { id: "emp1", email: "emp@test.com" },
};

const makeCtx = (id = "cr1") => ({ params: Promise.resolve({ id }) });
const makeReq = (body: object) =>
  new Request("http://localhost/api/shift-change-requests/cr1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/shift-change-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstCallCount = 0;
    mockSession.user = null;
    mockFindAfter.mockResolvedValue({ ...pendingRequest, status: "STORNIERT" });
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "cancel" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when request not found", async () => {
    mockSession.user = empUser;
    mockFindFirst.mockResolvedValue(null);
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "cancel" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 400 when request is already processed", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue({ ...pendingRequest, status: "GENEHMIGT" });
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("employee can cancel their own request", async () => {
    mockSession.user = empUser;
    mockFindFirst.mockResolvedValue(pendingRequest);
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp1" });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindAfter.mockResolvedValue({ ...pendingRequest, status: "STORNIERT" });
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "cancel" }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("STORNIERT");
  });

  it("employee cannot cancel another employee's request", async () => {
    mockSession.user = empUser;
    mockFindFirst.mockResolvedValue({
      ...pendingRequest,
      requesterId: "other-emp",
    });
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp1" }); // emp1 linked
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "cancel" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("manager can reject a request", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(pendingRequest);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindAfter.mockResolvedValue({
      ...pendingRequest,
      status: "ABGELEHNT",
      shift: pendingRequest.shift,
      requester: pendingRequest.requester,
    });
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(
      makeReq({ action: "reject", reviewNote: "Kein Bedarf" }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
  });

  it("manager can approve a request (applies shift changes)", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(pendingRequest);
    const approvedReq = { ...pendingRequest, status: "GENEHMIGT" };
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          shiftChangeRequest: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          shift: { update: vi.fn().mockResolvedValue({ id: "s1" }) },
        };
        return fn(mockTx);
      },
    );
    mockFindAfter.mockResolvedValue(approvedReq);
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns 409 when concurrent update wins the race on cancel", async () => {
    mockSession.user = empUser;
    mockFindFirst.mockResolvedValue(pendingRequest);
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp1" });
    mockUpdateMany.mockResolvedValue({ count: 0 }); // already processed
    const { PATCH } =
      await import("@/app/api/shift-change-requests/[id]/route");
    const res = await PATCH(makeReq({ action: "cancel" }), makeCtx());
    expect(res.status).toBe(409);
  });
});
