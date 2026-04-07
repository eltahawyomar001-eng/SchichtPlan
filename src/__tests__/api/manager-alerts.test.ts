/**
 * Tests for /api/manager-alerts (GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    managerAlert: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
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

describe("GET /api/manager-alerts", () => {
  let handler: typeof import("@/app/api/manager-alerts/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/manager-alerts/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/manager-alerts");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE role (requires management)", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/manager-alerts");
    const res = await handler.GET(req);
    expect(res.status).toBe(403);
  });

  it("returns paginated alerts for manager", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const alerts = [{ id: "a1", severity: "HIGH", acknowledged: false }];
    mockPrisma.managerAlert.findMany.mockResolvedValue(alerts);
    mockPrisma.managerAlert.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/manager-alerts");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("filters by severity query param", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.managerAlert.findMany.mockResolvedValue([]);
    mockPrisma.managerAlert.count.mockResolvedValue(0);

    const req = new Request(
      "http://localhost/api/manager-alerts?severity=HIGH",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.managerAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "HIGH" }),
      }),
    );
  });
});
