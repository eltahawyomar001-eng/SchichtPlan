/**
 * @vitest-environment node
 *
 * Tests for Locations API:
 *   GET  /api/locations — list locations
 *   POST /api/locations — create location
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockLocationFindMany,
  mockLocationCount,
  mockLocationCreate,
  mockSubscriptionFindUnique,
  mockUsageFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockLocationFindMany: vi.fn(),
  mockLocationCount: vi.fn(),
  mockLocationCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockUsageFindUnique: vi.fn(),
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
    location: {
      findMany: mockLocationFindMany,
      count: mockLocationCount,
      create: mockLocationCreate,
    },
    subscription: { findUnique: mockSubscriptionFindUnique },
    workspaceUsage: {
      findUnique: mockUsageFindUnique,
      create: vi
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "usage-1", ...args.data }),
        ),
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

import { buildAdmin, buildEmployee } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/locations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/locations", () => {
  let handler: typeof import("@/app/api/locations/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/locations/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/locations"),
    );
    expect(res.status).toBe(401);
  });

  it("returns locations for admin", async () => {
    mockSession.user = buildAdmin();
    mockLocationFindMany.mockResolvedValue([
      { id: "l1", name: "HQ", address: "123 Main St" },
    ]);
    mockLocationCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/locations"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("filters by workspaceId", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-test" });
    mockLocationFindMany.mockResolvedValue([]);
    mockLocationCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/locations"));
    const call = mockLocationFindMany.mock.calls[0][0];
    expect(call.where.workspaceId).toBe("ws-test");
  });
});

describe("POST /api/locations", () => {
  let handler: typeof import("@/app/api/locations/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/locations/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq({ name: "Office" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(postReq({ name: "Office" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing name", async () => {
    mockSession.user = buildAdmin();
    const res = await handler.POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("creates location successfully", async () => {
    mockSession.user = buildAdmin();
    // Allow location slot check to pass
    mockLocationCount.mockResolvedValue(0);
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockUsageFindUnique.mockResolvedValue(null);
    mockLocationCreate.mockResolvedValue({
      id: "l1",
      name: "Office",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Office" }));
    expect(res.status).toBe(201);
    expect(mockLocationCreate).toHaveBeenCalledOnce();
  });
});
