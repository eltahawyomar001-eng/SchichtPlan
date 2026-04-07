/**
 * @vitest-environment node
 *
 * Tests for Clients API:
 *   GET  /api/clients — list clients
 *   POST /api/clients — create client
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockClientFindMany,
  mockClientCount,
  mockClientCreate,
  mockSubscriptionFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockClientFindMany: vi.fn(),
  mockClientCount: vi.fn(),
  mockClientCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
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
    client: {
      findMany: mockClientFindMany,
      count: mockClientCount,
      create: mockClientCreate,
    },
    subscription: { findUnique: mockSubscriptionFindUnique },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  },
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
  return new Request("http://localhost/api/clients", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/clients", () => {
  let handler: typeof import("@/app/api/clients/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/clients/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/clients"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to list", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.GET(new Request("http://localhost/api/clients"));
    expect(res.status).toBe(403);
  });

  it("returns clients for admin", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockClientFindMany.mockResolvedValue([
      { id: "c1", name: "ACME Corp", workspaceId: "ws-1" },
    ]);
    mockClientCount.mockResolvedValue(1);

    const res = await handler.GET(new Request("http://localhost/api/clients"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/clients", () => {
  let handler: typeof import("@/app/api/clients/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/clients/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq({ name: "Client A" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(postReq({ name: "Client A" }));
    expect(res.status).toBe(403);
  });

  it("creates client successfully", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockClientCreate.mockResolvedValue({
      id: "c1",
      name: "Client A",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Client A" }));
    expect(res.status).toBe(201);
    expect(mockClientCreate).toHaveBeenCalledOnce();
  });
});
