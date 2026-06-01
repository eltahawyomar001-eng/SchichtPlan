/**
 * @vitest-environment node
 *
 * Tests for PATCH / DELETE /api/automation-rules/[id]
 *
 * Only managers with automations:update/delete permission can modify rules.
 * JSON conditions/actions are serialized to strings on write and parsed back on read.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindFirst, mockUpdate, mockDelete } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockFindFirst: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
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
    automationRule: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      delete: mockDelete,
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

// automations permission is OWNER/ADMIN only — MANAGER is locked out
const admin: SessionUser = {
  id: "u1",
  email: "admin@test.com",
  workspaceId: "ws1",
  role: "ADMIN",
  employeeId: null,
  name: "Admin",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const manager: SessionUser = { ...admin, id: "u3", role: "MANAGER" };
const emp: SessionUser = {
  ...admin,
  id: "u2",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const rule = {
  id: "ar1",
  workspaceId: "ws1",
  name: "Overtime Alert",
  conditions: "[]",
  actions: "[]",
  isActive: true,
};

const makeCtx = (id = "ar1") => ({ params: Promise.resolve({ id }) });
const patchReq = (body: object) =>
  new Request("http://localhost/api/automation-rules/ar1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () =>
  new Request("http://localhost/api/automation-rules/ar1", {
    method: "DELETE",
  });

describe("PATCH /api/automation-rules/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/automation-rules/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { PATCH } = await import("@/app/api/automation-rules/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when rule not found", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/automation-rules/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("updates rule and parses conditions/actions from JSON strings", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(rule);
    mockUpdate.mockResolvedValue({
      ...rule,
      isActive: false,
      conditions: "[]",
      actions: "[]",
    });
    const { PATCH } = await import("@/app/api/automation-rules/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isActive).toBe(false);
    expect(Array.isArray(body.conditions)).toBe(true);
    expect(Array.isArray(body.actions)).toBe(true);
  });
});

describe("DELETE /api/automation-rules/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/automation-rules/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { DELETE } = await import("@/app/api/automation-rules/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when rule not found", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/automation-rules/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("deletes rule and returns success", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(rule);
    mockDelete.mockResolvedValue({});
    const { DELETE } = await import("@/app/api/automation-rules/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
