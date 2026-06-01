/**
 * @vitest-environment node
 *
 * Tests for PATCH /api/ticket-categories/[id]
 *
 * OWNER/ADMIN only. Renames, recolors, reorders, or soft-deletes (isActive:false).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
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
    ticketCategoryDef: { findFirst: mockFindFirst, update: mockUpdate },
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
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };

const category = {
  id: "cat1",
  name: "Bug",
  slug: "bug",
  color: "#f00",
  isActive: true,
};

const makeCtx = (id = "cat1") => ({ params: Promise.resolve({ id }) });
const patchReq = (body: object) =>
  new Request("http://localhost/api/ticket-categories/cat1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/ticket-categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/ticket-categories/[id]/route");
    const res = await PATCH(patchReq({ name: "New" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls", async () => {
    mockSession.user = manager;
    const { PATCH } = await import("@/app/api/ticket-categories/[id]/route");
    const res = await PATCH(patchReq({ name: "New" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when category not found", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/ticket-categories/[id]/route");
    const res = await PATCH(patchReq({ name: "New" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("updates category name and returns updated record", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(category);
    mockUpdate.mockResolvedValue({ ...category, name: "Critical Bug" });
    const { PATCH } = await import("@/app/api/ticket-categories/[id]/route");
    const res = await PATCH(patchReq({ name: "Critical Bug" }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Critical Bug");
  });

  it("soft-deletes by setting isActive:false", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(category);
    mockUpdate.mockResolvedValue({ ...category, isActive: false });
    const { PATCH } = await import("@/app/api/ticket-categories/[id]/route");
    const res = await PATCH(patchReq({ isActive: false }), makeCtx());
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });
});
