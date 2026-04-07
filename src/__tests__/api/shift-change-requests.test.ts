/**
 * Tests for /api/shift-change-requests (GET, POST)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    shiftChangeRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    employee: { findFirst: vi.fn() },
    shift: { findUnique: vi.fn() },
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
vi.mock("@/lib/automations", () => ({
  createSystemNotification: vi.fn(),
}));
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn(() => ({ take: 50, skip: 0 })),
  paginatedResponse: vi.fn(
    async (data: unknown[], total: number, take: number, skip: number) => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({
        data,
        pagination: {
          total,
          limit: take,
          offset: skip,
          hasMore: total > skip + take,
        },
      });
    },
  ),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

describe("GET /api/shift-change-requests", () => {
  let handler: typeof import("@/app/api/shift-change-requests/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-change-requests/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/shift-change-requests");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns all requests for management", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const requests = [{ id: "scr1", status: "AUSSTEHEND" }];
    mockPrisma.shiftChangeRequest.findMany.mockResolvedValue(requests);
    mockPrisma.shiftChangeRequest.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/shift-change-requests");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("scopes results for EMPLOYEE role", async () => {
    const emp = buildEmployee({ email: "emp@test.com" });
    mockSession.user = emp;
    mockPrisma.employee.findFirst.mockResolvedValue({ id: "e1" });
    mockPrisma.shiftChangeRequest.findMany.mockResolvedValue([]);
    mockPrisma.shiftChangeRequest.count.mockResolvedValue(0);

    const req = new Request("http://localhost/api/shift-change-requests");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.shiftChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requesterId: "e1" }),
      }),
    );
  });

  it("returns empty for employee with no linked employee record", async () => {
    const emp = buildEmployee({ email: "orphan@test.com" });
    mockSession.user = emp;
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const req = new Request("http://localhost/api/shift-change-requests");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("POST /api/shift-change-requests", () => {
  let handler: typeof import("@/app/api/shift-change-requests/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-change-requests/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/shift-change-requests", {
      method: "POST",
      body: JSON.stringify({ shiftId: "s1", reason: "schedule conflict" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for no workspaceId", async () => {
    mockSession.user = buildOwner({ workspaceId: "" });
    const req = new Request("http://localhost/api/shift-change-requests", {
      method: "POST",
      body: JSON.stringify({ shiftId: "s1", reason: "schedule conflict" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(400);
  });
});
