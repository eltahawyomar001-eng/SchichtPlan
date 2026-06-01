/**
 * @vitest-environment node
 *
 * Tests for PATCH /api/shift-swaps/[id]
 *
 * Status machine: ANGEFRAGT → ANGENOMMEN (by target) → GENEHMIGT/ABGELEHNT (by manager)
 *                 ANGEFRAGT/ANGENOMMEN → STORNIERT (by requester or manager)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockSwapFindUnique, mockSwapUpdateMany, mockTransaction } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockSwapFindUnique: vi.fn(),
    mockSwapUpdateMany: vi.fn(),
    mockTransaction: vi.fn().mockResolvedValue(undefined),
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
    shiftSwapRequest: {
      // Each test configures this directly via mockSwapFindUnique.mockResolvedValueOnce
      findUnique: mockSwapFindUnique,
      updateMany: mockSwapUpdateMany,
      update: vi.fn().mockResolvedValue({}),
    },
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
  tryAutoApproveSwap: vi.fn().mockResolvedValue(false),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/e-signature", () => ({
  createESignature: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
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
  employeeId: "mgr-emp",
  name: "Manager",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const targetEmployee: SessionUser = {
  id: "u2",
  email: "target@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "target-emp",
  name: "Target",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const requesterEmployee: SessionUser = {
  id: "u3",
  email: "req@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "req-emp",
  name: "Requester",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

const openSwap = {
  id: "swap1",
  workspaceId: "ws1",
  status: "ANGEFRAGT",
  requesterId: "req-emp",
  targetId: "target-emp",
  shiftId: "s1",
  targetShiftId: "s2",
  shift: { date: new Date("2026-07-01"), startTime: "08:00", endTime: "16:00" },
  targetShift: { date: new Date("2026-07-02") },
  requester: { email: "req@test.com" },
  target: { email: "target@test.com" },
};
const acceptedSwap = {
  ...openSwap,
  status: "ANGENOMMEN",
  targetId: "target-emp",
};

const makeCtx = (id = "swap1") => ({ params: Promise.resolve({ id }) });
const makeReq = (body: object) =>
  new Request("http://localhost/api/shift-swaps/swap1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/shift-swaps/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ANGENOMMEN" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when swap does not exist", async () => {
    mockSession.user = targetEmployee;
    mockSwapFindUnique.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ANGENOMMEN" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 404 when swap belongs to a different workspace", async () => {
    mockSession.user = targetEmployee;
    mockSwapFindUnique.mockResolvedValue({ ...openSwap, workspaceId: "ws99" });
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ANGENOMMEN" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 400 when requester tries to accept their own swap (no named target)", async () => {
    // Use a swap with no named target so the "wrong target" check is skipped
    mockSession.user = requesterEmployee;
    mockSwapFindUnique.mockResolvedValue({ ...openSwap, targetId: null });
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ANGENOMMEN" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 403 when wrong employee tries to accept a targeted swap", async () => {
    mockSession.user = { ...targetEmployee, employeeId: "other-emp" };
    mockSwapFindUnique.mockResolvedValue(openSwap); // targetId: target-emp
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ANGENOMMEN" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("accepts a swap when called by the target employee", async () => {
    mockSession.user = targetEmployee;
    mockSwapFindUnique
      .mockResolvedValueOnce(openSwap) // initial fetch
      .mockResolvedValueOnce(acceptedSwap); // re-fetch after update
    mockSwapUpdateMany.mockResolvedValue({ count: 1 });
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ANGENOMMEN" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("allows manager to approve a swap", async () => {
    mockSession.user = manager;
    const acceptedSwap = { ...openSwap, status: "ANGENOMMEN" };
    const approvedSwap = { ...acceptedSwap, status: "ABGESCHLOSSEN" };
    mockSwapFindUnique
      .mockResolvedValueOnce(acceptedSwap) // initial fetch
      .mockResolvedValueOnce(approvedSwap); // re-fetch after transaction
    mockSwapUpdateMany.mockResolvedValue({ count: 1 });
    mockTransaction.mockResolvedValue(undefined);
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "GENEHMIGT" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("allows requester to cancel their own swap", async () => {
    mockSession.user = requesterEmployee;
    const cancelledSwap = { ...openSwap, status: "STORNIERT" };
    mockSwapFindUnique
      .mockResolvedValueOnce(openSwap) // initial fetch
      .mockResolvedValueOnce(cancelledSwap); // re-fetch after update
    mockSwapUpdateMany.mockResolvedValue({ count: 1 });
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "STORNIERT" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns 409 when concurrent update wins the race", async () => {
    mockSession.user = manager;
    mockSwapFindUnique.mockResolvedValue(openSwap);
    mockSwapUpdateMany.mockResolvedValue({ count: 0 }); // another request won
    const { PATCH } = await import("@/app/api/shift-swaps/[id]/route");
    const res = await PATCH(makeReq({ status: "ABGELEHNT" }), makeCtx());
    expect(res.status).toBe(409);
  });
});
