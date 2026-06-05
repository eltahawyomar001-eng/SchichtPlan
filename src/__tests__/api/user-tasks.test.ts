/**
 * @vitest-environment node
 *
 * Tests for user-tasks API (dashboard "My Tasks" widget):
 *   GET    /api/user-tasks        — list tasks
 *   POST   /api/user-tasks        — create task
 *   PATCH  /api/user-tasks/[id]   — update task
 *   DELETE /api/user-tasks/[id]   — delete task
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockFindMany,
  mockCreate,
  mockFindUnique,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
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
  prisma: {
    userTask: {
      findMany: mockFindMany,
      create: mockCreate,
      findUnique: mockFindUnique,
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

const user1: SessionUser = {
  id: "u1",
  email: "user@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "User",
};

const makeCtx = (id = "task1") => ({
  params: Promise.resolve({ id }),
});

const sampleTask = {
  id: "task1",
  title: "Buy milk",
  done: false,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/user-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/user-tasks/route");
    const res = await GET(new Request("http://localhost/api/user-tasks"));
    expect(res.status).toBe(401);
  });

  it("returns empty task list", async () => {
    mockSession.user = user1;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/user-tasks/route");
    const res = await GET(new Request("http://localhost/api/user-tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toEqual([]);
  });

  it("returns tasks for the authenticated user", async () => {
    mockSession.user = user1;
    mockFindMany.mockResolvedValue([sampleTask]);
    const { GET } = await import("@/app/api/user-tasks/route");
    const res = await GET(new Request("http://localhost/api/user-tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("Buy milk");
  });
});

describe("POST /api/user-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/user-tasks/route");
    const req = new Request("http://localhost/api/user-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    mockSession.user = user1;
    const { POST } = await import("@/app/api/user-tasks/route");
    const req = new Request("http://localhost/api/user-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty string", async () => {
    mockSession.user = user1;
    const { POST } = await import("@/app/api/user-tasks/route");
    const req = new Request("http://localhost/api/user-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a task and returns 201", async () => {
    mockSession.user = user1;
    mockCreate.mockResolvedValue(sampleTask);
    const { POST } = await import("@/app/api/user-tasks/route");
    const req = new Request("http://localhost/api/user-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Buy milk");
  });
});

describe("PATCH /api/user-tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when task belongs to another user", async () => {
    mockSession.user = user1;
    mockFindUnique.mockResolvedValue({ userId: "u2" }); // different user
    const { PATCH } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 404 when task does not exist", async () => {
    mockSession.user = user1;
    mockFindUnique.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(404);
  });

  it("marks task as done", async () => {
    mockSession.user = user1;
    mockFindUnique.mockResolvedValue({ userId: "u1" });
    mockUpdate.mockResolvedValue({ ...sampleTask, done: true });
    const { PATCH } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.done).toBe(true);
  });
});

describe("DELETE /api/user-tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when task belongs to another user", async () => {
    mockSession.user = user1;
    mockFindUnique.mockResolvedValue({ userId: "u2" });
    const { DELETE } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(404);
  });

  it("deletes task and returns success", async () => {
    mockSession.user = user1;
    mockFindUnique.mockResolvedValue({ userId: "u1" });
    mockDelete.mockResolvedValue({});
    const { DELETE } = await import("@/app/api/user-tasks/[id]/route");
    const req = new Request("http://localhost/api/user-tasks/task1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
