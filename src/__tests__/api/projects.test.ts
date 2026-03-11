/**
 * @vitest-environment node
 *
 * Tests for Projects API:
 *   GET  /api/projects — list projects
 *   POST /api/projects — create project
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockProjectFindMany,
  mockProjectCount,
  mockProjectCreate,
  mockSubscriptionFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockProjectFindMany: vi.fn(),
  mockProjectCount: vi.fn(),
  mockProjectCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
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
    project: {
      findMany: mockProjectFindMany,
      count: mockProjectCount,
      create: mockProjectCreate,
    },
    subscription: { findUnique: mockSubscriptionFindUnique },
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

import { buildAdmin, buildEmployee, buildManager } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/projects", () => {
  let handler: typeof import("@/app/api/projects/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/projects/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/projects"));
    expect(res.status).toBe(401);
  });

  it("returns projects when EMPLOYEE reads (has projects:read)", async () => {
    mockSession.user = buildEmployee();
    mockProjectFindMany.mockResolvedValue([]);
    mockProjectCount.mockResolvedValue(0);
    const res = await handler.GET(new Request("http://localhost/api/projects"));
    expect(res.status).toBe(200);
  });

  it("returns projects for admin", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockProjectFindMany.mockResolvedValue([
      { id: "p1", name: "Website", workspaceId: "ws-1" },
    ]);
    mockProjectCount.mockResolvedValue(1);

    const res = await handler.GET(new Request("http://localhost/api/projects"));
    expect(res.status).toBe(200);
  });

  it("supports status filter", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockProjectFindMany.mockResolvedValue([]);
    mockProjectCount.mockResolvedValue(0);

    await handler.GET(
      new Request("http://localhost/api/projects?status=ACTIVE"),
    );
    const call = mockProjectFindMany.mock.calls[0][0];
    expect(call.where.status).toBe("ACTIVE");
  });
});

describe("POST /api/projects", () => {
  let handler: typeof import("@/app/api/projects/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/projects/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq({ name: "New Project" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(postReq({ name: "New Project" }));
    expect(res.status).toBe(403);
  });

  it("creates project successfully", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockProjectCreate.mockResolvedValue({
      id: "p1",
      name: "New Project",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "New Project" }));
    expect(res.status).toBe(201);
    expect(mockProjectCreate).toHaveBeenCalledOnce();
  });

  it("MANAGER can create projects", async () => {
    mockSession.user = buildManager();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockProjectCreate.mockResolvedValue({
      id: "p2",
      name: "Backend",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Backend" }));
    expect(res.status).toBe(201);
  });
});
