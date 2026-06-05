/**
 * @vitest-environment node
 *
 * Tests for PUT / DELETE /api/shift-templates/[id]
 *
 * PUT  requires shifts:update  → MANAGER+
 * DELETE requires shifts:delete → MANAGER+
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
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
  prisma: { shiftTemplate: { update: mockUpdate, delete: mockDelete } },
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

const makeCtx = (id = "tmpl1") => ({ params: Promise.resolve({ id }) });
const putReq = (body: object) =>
  new Request("http://localhost/api/shift-templates/tmpl1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () =>
  new Request("http://localhost/api/shift-templates/tmpl1", {
    method: "DELETE",
  });

describe("PUT /api/shift-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PUT } = await import("@/app/api/shift-templates/[id]/route");
    const res = await PUT(
      putReq({ name: "Morning", startTime: "06:00", endTime: "14:00" }),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { PUT } = await import("@/app/api/shift-templates/[id]/route");
    const res = await PUT(
      putReq({ name: "Morning", startTime: "06:00", endTime: "14:00" }),
      makeCtx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when time format is invalid", async () => {
    mockSession.user = manager;
    const { PUT } = await import("@/app/api/shift-templates/[id]/route");
    const res = await PUT(
      putReq({ name: "Bad", startTime: "not-a-time", endTime: "25:99" }),
      makeCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("updates template and returns it", async () => {
    mockSession.user = manager;
    const tmpl = {
      id: "tmpl1",
      name: "Morning",
      startTime: "06:00",
      endTime: "14:00",
      color: null,
      locationId: null,
    };
    mockUpdate.mockResolvedValue(tmpl);
    const { PUT } = await import("@/app/api/shift-templates/[id]/route");
    const res = await PUT(
      putReq({ name: "Morning", startTime: "06:00", endTime: "14:00" }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Morning");
  });
});

describe("DELETE /api/shift-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/shift-templates/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { DELETE } = await import("@/app/api/shift-templates/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("deletes template and returns success", async () => {
    mockSession.user = manager;
    mockDelete.mockResolvedValue({});
    const { DELETE } = await import("@/app/api/shift-templates/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
