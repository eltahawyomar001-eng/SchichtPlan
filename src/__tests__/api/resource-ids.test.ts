/**
 * Tests for /api/departments/[id] (PUT, DELETE),
 * /api/locations/[id] (PATCH, DELETE),
 * /api/shifts/[id] (PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    department: { update: vi.fn(), delete: vi.fn() },
    location: { updateMany: vi.fn(), deleteMany: vi.fn() },
    shift: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
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
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogTx: vi.fn(),
}));
vi.mock("@/lib/automations", () => ({
  checkShiftConflicts: vi.fn(() => []),
  executeCustomRules: vi.fn(),
  createSystemNotification: vi.fn(),
}));
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));

import { buildOwner, buildEmployee } from "../helpers/factories";

// ── /api/departments/[id] ──
describe("PUT /api/departments/[id]", () => {
  let handler: typeof import("@/app/api/departments/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/departments/[id]/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/departments/d1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await handler.PUT(req, {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/departments/d1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await handler.PUT(req, {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(403);
  });

  it("updates department successfully", async () => {
    mockSession.user = buildOwner();
    const updated = { id: "d1", name: "New Name" };
    mockPrisma.department.update.mockResolvedValue(updated);
    const req = new Request("http://localhost/api/departments/d1", {
      method: "PUT",
      body: JSON.stringify({ name: "New Name" }),
    });
    const res = await handler.PUT(req, {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("New Name");
  });
});

describe("DELETE /api/departments/[id]", () => {
  let handler: typeof import("@/app/api/departments/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/departments/[id]/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/departments/d1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(401);
  });

  it("deletes department successfully", async () => {
    mockSession.user = buildOwner();
    mockPrisma.department.delete.mockResolvedValue({});
    const req = new Request("http://localhost/api/departments/d1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── /api/locations/[id] ──
describe("PATCH /api/locations/[id]", () => {
  let handler: typeof import("@/app/api/locations/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/locations/[id]/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/locations/l1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "l1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/locations/l1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "l1" }),
    });
    expect(res.status).toBe(403);
  });

  it("updates location scoped by workspaceId", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.location.updateMany.mockResolvedValue({ count: 1 });
    const req = new Request("http://localhost/api/locations/l1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Berlin Office" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "l1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.location.updateMany).toHaveBeenCalledWith({
      where: { id: "l1", workspaceId: owner.workspaceId },
      data: expect.objectContaining({ name: "Berlin Office" }),
    });
  });
});

describe("DELETE /api/locations/[id]", () => {
  let handler: typeof import("@/app/api/locations/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/locations/[id]/route");
  });

  it("returns 403 for EMPLOYEE", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/locations/l1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "l1" }),
    });
    expect(res.status).toBe(403);
  });

  it("deletes location scoped by workspaceId", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.location.deleteMany.mockResolvedValue({ count: 1 });
    const req = new Request("http://localhost/api/locations/l1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "l1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.location.deleteMany).toHaveBeenCalledWith({
      where: { id: "l1", workspaceId: owner.workspaceId },
    });
  });
});

// ── /api/shifts/[id] ──
describe("PATCH /api/shifts/[id]", () => {
  let handler: typeof import("@/app/api/shifts/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shifts/[id]/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/shifts/s1", {
      method: "PATCH",
      body: JSON.stringify({ startTime: "09:00" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/shifts/s1", {
      method: "PATCH",
      body: JSON.stringify({ startTime: "09:00" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when shift not in workspace", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.shift.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/shifts/s1", {
      method: "PATCH",
      body: JSON.stringify({ startTime: "09:00" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(404);
  });
});
