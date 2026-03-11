/**
 * @vitest-environment node
 *
 * Tests for Departments API:
 *   GET  /api/departments — list departments
 *   POST /api/departments — create department
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockDepartmentFindMany,
  mockDepartmentCount,
  mockDepartmentCreate,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockDepartmentFindMany: vi.fn(),
  mockDepartmentCount: vi.fn(),
  mockDepartmentCreate: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    department: {
      findMany: mockDepartmentFindMany,
      count: mockDepartmentCount,
      create: mockDepartmentCreate,
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  },
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn().mockReturnValue({ take: 50, skip: 0 }),
  paginatedResponse: vi.fn(
    async (items: unknown[], total: number, take: number, skip: number) => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ data: items, total, take, skip });
    },
  ),
}));

import { buildAdmin, buildManager, buildEmployee } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/departments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/departments", () => {
  let handler: typeof import("@/app/api/departments/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/departments/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/departments"),
    );
    expect(res.status).toBe(401);
  });

  it("returns departments for admin", async () => {
    mockSession.user = buildAdmin();
    mockDepartmentFindMany.mockResolvedValue([
      { id: "d1", name: "Engineering" },
    ]);
    mockDepartmentCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/departments"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("filters by workspaceId", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-test" });
    mockDepartmentFindMany.mockResolvedValue([]);
    mockDepartmentCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/departments"));
    const call = mockDepartmentFindMany.mock.calls[0][0];
    expect(call.where.workspaceId).toBe("ws-test");
  });
});

describe("POST /api/departments", () => {
  let handler: typeof import("@/app/api/departments/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/departments/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq({ name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(postReq({ name: "Test" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing name", async () => {
    mockSession.user = buildAdmin();
    const res = await handler.POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("creates department successfully", async () => {
    mockSession.user = buildAdmin();
    mockDepartmentCreate.mockResolvedValue({
      id: "d1",
      name: "Engineering",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Engineering" }));
    expect(res.status).toBe(201);
    expect(mockDepartmentCreate).toHaveBeenCalledOnce();
  });

  it("MANAGER can create departments", async () => {
    mockSession.user = buildManager();
    mockDepartmentCreate.mockResolvedValue({
      id: "d2",
      name: "Sales",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Sales" }));
    expect(res.status).toBe(201);
  });
});
