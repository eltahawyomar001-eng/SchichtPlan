/**
 * @vitest-environment node
 *
 * Tests for GET / PUT /api/skills/[id]/assignments
 *
 * GET: returns employee IDs assigned to a skill (any authenticated user).
 * PUT: syncs the full assignment list (adds/removes). Requires employees:update.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockSkillFindFirst,
  mockAssignFindMany,
  mockDeleteMany,
  mockCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockSkillFindFirst: vi.fn(),
  mockAssignFindMany: vi.fn(),
  mockDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCreate: vi.fn().mockResolvedValue({}),
  mockTransaction: vi.fn().mockResolvedValue([]),
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
    skill: { findFirst: mockSkillFindFirst },
    employeeSkill: {
      findMany: mockAssignFindMany,
      deleteMany: mockDeleteMany,
      create: mockCreate,
    },
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

const makeCtx = (id = "sk1") => ({ params: Promise.resolve({ id }) });
const putReq = (body: object) =>
  new Request("http://localhost/api/skills/sk1/assignments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/skills/[id]/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await GET(
      new Request("http://localhost/api/skills/sk1/assignments"),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns list of employee IDs assigned to skill", async () => {
    mockSession.user = manager;
    mockAssignFindMany.mockResolvedValue([
      { employeeId: "emp1" },
      { employeeId: "emp2" },
    ]);
    const { GET } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await GET(
      new Request("http://localhost/api/skills/sk1/assignments"),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(["emp1", "emp2"]);
  });

  it("returns empty array when no assignments", async () => {
    mockSession.user = emp;
    mockAssignFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await GET(
      new Request("http://localhost/api/skills/sk1/assignments"),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe("PUT /api/skills/[id]/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PUT } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await PUT(putReq({ employeeIds: [] }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { PUT } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await PUT(putReq({ employeeIds: [] }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when skill not found", async () => {
    mockSession.user = manager;
    mockSkillFindFirst.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await PUT(putReq({ employeeIds: ["emp1"] }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("syncs assignments and returns success", async () => {
    mockSession.user = manager;
    mockSkillFindFirst.mockResolvedValue({ id: "sk1", workspaceId: "ws1" });
    mockAssignFindMany.mockResolvedValue([]); // no current assignments
    mockTransaction.mockResolvedValue([]);
    const { PUT } = await import("@/app/api/skills/[id]/assignments/route");
    const res = await PUT(putReq({ employeeIds: ["emp1", "emp2"] }), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
