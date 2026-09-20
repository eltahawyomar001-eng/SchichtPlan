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
  mockResolveGeo,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockLocationFindMany: vi.fn(),
  mockLocationCount: vi.fn(),
  mockLocationCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockUsageFindUnique: vi.fn(),
  mockResolveGeo: vi.fn(),
}));

/**
 * Creating a location resolves its coordinates inline.
 *
 * Mocked here so the test never touches a geocoding provider, but asserted on:
 * geocoding used to run only from a manual button, so objects created through
 * this route had no coordinates, and without a reference point every punch and
 * every proof photo at them came back unverifiable.
 */
vi.mock("@/lib/geocode", () => ({
  resolveAndPersistLocationGeo: mockResolveGeo,
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
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
      if (!mockSession.user.workspaceId) {
        const { NextResponse } = await import("next/server");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "No workspace" },
            { status: 400 },
          ),
        };
      }
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId as string,
      };
    }),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
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
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withRequestId: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn().mockReturnValue({ take: 50, skip: 0 }),
  paginatedResponse: vi.fn(
    (items: unknown[], total: number, take: number, skip: number) => {
      const body = JSON.stringify({ data: items, total, take, skip });
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    mockLocationCount.mockResolvedValue(0);
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

  it("resolves coordinates for the new location", async () => {
    mockSession.user = buildAdmin();
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
    mockResolveGeo.mockResolvedValue({ lat: 52.52, lon: 13.405 });

    const res = await handler.POST(
      postReq({ name: "Office", address: "Alexanderplatz 1, 10178 Berlin" }),
    );

    expect(mockResolveGeo).toHaveBeenCalledWith("l1", {
      budgetMs: expect.any(Number),
    });
    // Returned to the client too, so the form shows the pin without a reload.
    const body = await res.json();
    expect(body.latitude).toBe(52.52);
    expect(body.longitude).toBe(13.405);
  });

  it("still creates the location when geocoding fails", async () => {
    // A geocoding provider is a third party on someone else's network. It must
    // never be able to stop a manager from creating an object.
    mockSession.user = buildAdmin();
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
    mockResolveGeo.mockResolvedValue(null);

    const res = await handler.POST(postReq({ name: "Office" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("l1");
    expect(body.latitude).toBeUndefined();
  });
});
