/**
 * Tests for /api/team (GET) and /api/team/[id] (PATCH, DELETE)
 * and /api/team/transfer-ownership (POST)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  },
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
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
  cronMonitor: vi.fn(() => ({ start: vi.fn(), error: vi.fn(), ok: vi.fn() })),
}));

import { buildOwner, buildAdmin, buildEmployee } from "../helpers/factories";

// ── /api/team ──
describe("GET /api/team", () => {
  let handler: typeof import("@/app/api/team/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/team/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no workspaceId", async () => {
    mockSession.user = buildOwner({ workspaceId: "" });
    const res = await handler.GET(new Request("http://localhost"));
    expect(res.status).toBe(400);
  });

  it("returns members scoped by workspaceId", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const members = [
      {
        id: "1",
        name: "A",
        email: "a@x.com",
        role: "ADMIN",
        createdAt: new Date(),
      },
    ];
    mockPrisma.user.findMany.mockResolvedValue(members);
    mockPrisma.user.count.mockResolvedValue(1);
    const res = await handler.GET(new Request("http://localhost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: owner.workspaceId } }),
    );
  });
});

// ── /api/team/[id] ──
describe("PATCH /api/team/[id]", () => {
  let handler: typeof import("@/app/api/team/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/team/[id]/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/team/t1", {
      method: "PATCH",
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-OWNER tries to change roles", async () => {
    mockSession.user = buildAdmin();
    const req = new Request("http://localhost/api/team/t1", {
      method: "PATCH",
      body: JSON.stringify({ role: "MANAGER" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when changing own role", async () => {
    const owner = buildOwner({ id: "me" });
    mockSession.user = owner;
    const req = new Request("http://localhost/api/team/me", {
      method: "PATCH",
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "me" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CANNOT_CHANGE_OWN_ROLE");
  });

  it("returns 404 when target is in a different workspace", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.user.findUnique.mockResolvedValue({
      workspaceId: "other-ws",
      role: "ADMIN",
    });
    const req = new Request("http://localhost/api/team/t1", {
      method: "PATCH",
      body: JSON.stringify({ role: "MANAGER" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(404);
  });

  it("updates role successfully", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.user.findUnique.mockResolvedValue({
      workspaceId: owner.workspaceId,
      role: "ADMIN",
    });
    mockPrisma.user.update.mockResolvedValue({});
    const req = new Request("http://localhost/api/team/t1", {
      method: "PATCH",
      body: JSON.stringify({ role: "MANAGER" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("DELETE /api/team/[id]", () => {
  let handler: typeof import("@/app/api/team/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/team/[id]/route");
  });

  it("returns 403 for EMPLOYEE role", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/team/t1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when trying to remove self", async () => {
    const owner = buildOwner({ id: "me" });
    mockSession.user = owner;
    const req = new Request("http://localhost/api/team/me", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "me" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CANNOT_REMOVE_SELF");
  });

  it("returns 400 when trying to remove OWNER", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.user.findUnique.mockResolvedValue({
      workspaceId: owner.workspaceId,
      role: "OWNER",
    });
    const req = new Request("http://localhost/api/team/t1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("CANNOT_REMOVE_OWNER");
  });

  it("removes member successfully", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.user.findUnique.mockResolvedValue({
      workspaceId: owner.workspaceId,
      role: "MANAGER",
    });
    mockPrisma.user.update.mockResolvedValue({});
    const req = new Request("http://localhost/api/team/t1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

// ── /api/team/transfer-ownership ──
describe("POST /api/team/transfer-ownership", () => {
  let handler: typeof import("@/app/api/team/transfer-ownership/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/team/transfer-ownership/route");
  });

  it("returns 403 for non-OWNER", async () => {
    mockSession.user = buildAdmin();
    const req = new Request("http://localhost/api/team/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "u2" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when transferring to self", async () => {
    const owner = buildOwner({ id: "me" });
    mockSession.user = owner;
    const req = new Request("http://localhost/api/team/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "me" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("CANNOT_TRANSFER_TO_SELF");
  });

  it("returns 404 when target not in workspace", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      workspaceId: "other-ws",
      name: "X",
      email: "x@x.com",
    });
    const req = new Request("http://localhost/api/team/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "u2" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(404);
  });

  it("transfers ownership successfully", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      workspaceId: owner.workspaceId,
      name: "Target",
      email: "target@x.com",
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn(mockPrisma),
    );
    mockPrisma.user.update.mockResolvedValue({});
    const req = new Request("http://localhost/api/team/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "u2" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.newOwner.email).toBe("target@x.com");
  });
});
