/**
 * @vitest-environment node
 *
 * Tests for POST / DELETE /api/projects/[id]/members
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockProjectFindFirst,
  mockMemberCreate,
  mockMemberDeleteMany,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockProjectFindFirst: vi.fn(),
  mockMemberCreate: vi.fn(),
  mockMemberDeleteMany: vi.fn(),
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
    project: { findFirst: mockProjectFindFirst },
    projectMember: {
      create: mockMemberCreate,
      deleteMany: mockMemberDeleteMany,
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

const project = { id: "p1", workspaceId: "ws1", name: "Project A" };

const makeCtx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const postReq = (body: object) =>
  new Request("http://localhost/api/projects/p1/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = (body: object) =>
  new Request("http://localhost/api/projects/p1/members", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/projects/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    const res = await POST(postReq({ employeeId: "emp1" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    const res = await POST(postReq({ employeeId: "emp1" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    mockSession.user = manager;
    mockProjectFindFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    const res = await POST(postReq({ employeeId: "emp1" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("adds member and returns 201", async () => {
    mockSession.user = manager;
    mockProjectFindFirst.mockResolvedValue(project);
    mockMemberCreate.mockResolvedValue({
      id: "m1",
      employeeId: "emp1",
      projectId: "p1",
      role: "MEMBER",
    });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    const res = await POST(postReq({ employeeId: "emp1" }), makeCtx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.employeeId).toBe("emp1");
  });
});

describe("DELETE /api/projects/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/projects/[id]/members/route");
    const res = await DELETE(deleteReq({ employeeId: "emp1" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("removes member and returns success", async () => {
    mockSession.user = manager;
    mockMemberDeleteMany.mockResolvedValue({ count: 1 });
    const { DELETE } = await import("@/app/api/projects/[id]/members/route");
    const res = await DELETE(deleteReq({ employeeId: "emp1" }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
