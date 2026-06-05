/**
 * @vitest-environment node
 *
 * Tests for PATCH and DELETE /api/webhooks/[id]
 *
 * Only managers with the webhooks:update permission can edit/delete.
 * Tests cover: auth, permission gating, 404, successful update, and delete.
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
    webhookEndpoint: {
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

const owner: SessionUser = {
  id: "u1",
  email: "owner@test.com",
  workspaceId: "ws1",
  role: "OWNER",
  employeeId: null,
  name: "Owner",
};
const empUser: SessionUser = {
  id: "u2",
  email: "emp@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "emp1",
  name: "Emp",
};

const existingHook = {
  id: "wh1",
  workspaceId: "ws1",
  url: "https://example.com/hook",
  events: ["time_entry.created"],
  isActive: true,
};

const makeCtx = (id = "wh1") => ({ params: Promise.resolve({ id }) });
const patchReq = (body: object) =>
  new Request("http://localhost/api/webhooks/wh1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () =>
  new Request("http://localhost/api/webhooks/wh1", { method: "DELETE" });

describe("PATCH /api/webhooks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by an employee", async () => {
    mockSession.user = empUser;
    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when webhook does not exist", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 400 when body fails schema validation", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(existingHook);
    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const res = await PATCH(patchReq({ url: "not-a-url" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("updates webhook and returns updated record", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(existingHook);
    const updated = { ...existingHook, isActive: false };
    mockUpdate.mockResolvedValue(updated);
    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isActive).toBe(false);
  });
});

describe("DELETE /api/webhooks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/webhooks/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by an employee", async () => {
    mockSession.user = empUser;
    const { DELETE } = await import("@/app/api/webhooks/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when webhook does not exist", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/webhooks/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("deletes the webhook and returns success", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(existingHook);
    mockDelete.mockResolvedValue({});
    const { DELETE } = await import("@/app/api/webhooks/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
