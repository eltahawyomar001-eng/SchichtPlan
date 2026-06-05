/**
 * @vitest-environment node
 *
 * Tests for GET / PUT / DELETE /api/staffing-requirements/[id]
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
    staffingRequirement: {
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

const req = {
  id: "sr1",
  workspaceId: "ws1",
  name: "Cashier Mon morning",
  weekday: 1,
  startTime: "08:00",
  endTime: "12:00",
  minEmployees: 2,
  maxEmployees: 4,
  isActive: true,
  location: null,
  department: null,
  requiredSkill: null,
};

const makeCtx = (id = "sr1") => ({ params: Promise.resolve({ id }) });
const putBody = {
  name: "Updated",
  weekday: 1,
  startTime: "09:00",
  endTime: "13:00",
  minEmployees: 3,
};

describe("GET /api/staffing-requirements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/staffing-requirements/sr1"),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when not found", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/staffing-requirements/sr1"),
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns requirement for authenticated user", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(req);
    const { GET } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/staffing-requirements/sr1"),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("sr1");
  });
});

describe("PUT /api/staffing-requirements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PUT } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      }),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee lacks permission", async () => {
    mockSession.user = emp;
    const { PUT } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      }),
      makeCtx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when requirement not found", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      }),
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("updates and returns requirement", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(req);
    mockUpdate.mockResolvedValue({
      ...req,
      ...putBody,
      location: null,
      department: null,
      requiredSkill: null,
    });
    const { PUT } = await import("@/app/api/staffing-requirements/[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated");
  });
});

describe("DELETE /api/staffing-requirements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } =
      await import("@/app/api/staffing-requirements/[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "DELETE",
      }),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when requirement not found", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(null);
    const { DELETE } =
      await import("@/app/api/staffing-requirements/[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "DELETE",
      }),
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("deletes and returns success", async () => {
    mockSession.user = manager;
    mockFindFirst.mockResolvedValue(req);
    mockDelete.mockResolvedValue({});
    const { DELETE } =
      await import("@/app/api/staffing-requirements/[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/staffing-requirements/sr1", {
        method: "DELETE",
      }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
