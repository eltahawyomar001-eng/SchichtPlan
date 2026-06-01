/**
 * @vitest-environment node
 *
 * Tests for GET / PATCH / DELETE /api/projects/[id]
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
    project: {
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

// reports:delete is OWNER/ADMIN only; reports:update allows MANAGER
const admin: SessionUser = {
  id: "u0",
  email: "admin@test.com",
  workspaceId: "ws1",
  role: "ADMIN",
  employeeId: null,
  name: "Admin",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
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

const project = {
  id: "p1",
  workspaceId: "ws1",
  name: "Project A",
  status: "ACTIVE",
  client: null,
  members: [],
  timeEntries: [],
};

const makeCtx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const patchReq = (body: object) =>
  new Request("http://localhost/api/projects/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () =>
  new Request("http://localhost/api/projects/p1", { method: "DELETE" });

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/projects/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/projects/p1"),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/projects/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/projects/p1"),
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns project with totalMinutes", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue({
      ...project,
      timeEntries: [{ netMinutes: 120 }, { netMinutes: 60 }],
    });
    const { GET } = await import("@/app/api/projects/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/projects/p1"),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalMinutes).toBe(180);
  });
});

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/projects/[id]/route");
    const res = await PATCH(patchReq({ name: "New" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { PATCH } = await import("@/app/api/projects/[id]/route");
    const res = await PATCH(patchReq({ name: "New" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/projects/[id]/route");
    const res = await PATCH(patchReq({ name: "New" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("updates project and returns it", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(project);
    mockUpdate.mockResolvedValue({ ...project, name: "Updated" });
    const { PATCH } = await import("@/app/api/projects/[id]/route");
    const res = await PATCH(patchReq({ name: "Updated" }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated");
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/projects/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER lacks reports:delete permission", async () => {
    mockSession.user = manager; // MANAGER can't delete projects
    const { DELETE } = await import("@/app/api/projects/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found (ADMIN)", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/projects/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("deletes project and returns success (ADMIN)", async () => {
    mockSession.user = admin;
    mockFindFirst.mockResolvedValue(project);
    mockDelete.mockResolvedValue({});
    const { DELETE } = await import("@/app/api/projects/[id]/route");
    const res = await DELETE(deleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
