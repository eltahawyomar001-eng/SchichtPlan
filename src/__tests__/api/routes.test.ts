/**
 * @vitest-environment node
 *
 * Integration tests for API route handlers.
 * Mock the session & Prisma layer so we can test route logic
 * (auth checks, permission guards, plan gating, response shapes)
 * without hitting a real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Shared mock state (hoisted for vi.mock factory access) ── */
const {
  mockSession,
  mockSubscriptionFindUnique,
  mockEmployeeCount,
  mockEmployeeFindMany,
  mockEmployeeCreate,
  mockLocationCount,
  mockLocationFindMany,
  mockLocationCreate,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockSubscriptionFindUnique: vi.fn(),
  mockEmployeeCount: vi.fn(),
  mockEmployeeFindMany: vi.fn(),
  mockEmployeeCreate: vi.fn(),
  mockLocationCount: vi.fn(),
  mockLocationFindMany: vi.fn(),
  mockLocationCreate: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: mockSubscriptionFindUnique },
    employee: {
      count: mockEmployeeCount,
      findMany: mockEmployeeFindMany,
      create: mockEmployeeCreate,
    },
    location: {
      count: mockLocationCount,
      findMany: mockLocationFindMany,
      create: mockLocationCreate,
    },
  },
}));

import {
  buildOwner,
  buildAdmin,
  buildManager,
  buildEmployee,
} from "../helpers/factories";

/* ═══════════════════════════════════════════════════════════════
   Employees API — /api/employees
   ═══════════════════════════════════════════════════════════════ */

describe("GET /api/employees", () => {
  let handler: typeof import("@/app/api/employees/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/employees/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/employees"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when user has no workspaceId", async () => {
    mockSession.user = buildOwner({ workspaceId: "" as string });
    const res = await handler.GET(
      new Request("http://localhost/api/employees"),
    );
    // Route checks for falsy workspaceId
    expect(res.status).toBe(400);
  });

  it("returns employees list for authenticated user", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const mockEmps = [
      { id: "e1", firstName: "Max", lastName: "Mustermann" },
      { id: "e2", firstName: "Erika", lastName: "Musterfrau" },
    ];
    mockEmployeeFindMany.mockResolvedValue(mockEmps);
    mockEmployeeCount.mockResolvedValue(2);

    const res = await handler.GET(
      new Request("http://localhost/api/employees"),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].firstName).toBe("Max");
  });
});

describe("POST /api/employees", () => {
  let handler: typeof import("@/app/api/employees/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/employees/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Test", lastName: "User" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Test", lastName: "User" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when employee limit is reached (PLAN_LIMIT)", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    // Starter plan: 5 max employees
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "STARTER",
      status: "ACTIVE",
      workspaceId: owner.workspaceId,
    });
    mockEmployeeCount.mockResolvedValue(5);

    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "User",
        email: "test@test.com",
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe("PLAN_LIMIT");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Custom Roles API — /api/custom-roles
   ═══════════════════════════════════════════════════════════════ */

describe("GET /api/custom-roles", () => {
  let handler: typeof import("@/app/api/custom-roles/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/custom-roles/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/custom-roles");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to access", async () => {
    mockSession.user = buildEmployee();
    // customRoles gated — but auth check should fail first
    const req = new Request("http://localhost/api/custom-roles");
    const res = await handler.GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when MANAGER tries to access (admin-only)", async () => {
    mockSession.user = buildManager();
    const req = new Request("http://localhost/api/custom-roles");
    const res = await handler.GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for admin on starter plan (feature gated)", async () => {
    mockSession.user = buildAdmin();
    // Starter plan doesn't have customRoles
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/custom-roles");
    const res = await handler.GET(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe("PLAN_LIMIT");
  });

  it("returns built-in roles for admin on business plan", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "BUSINESS",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/custom-roles");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(4);
    expect(body[0].id).toBe("owner");
    expect(body[1].id).toBe("admin");
    expect(body[2].id).toBe("manager");
    expect(body[3].id).toBe("employee");
  });
});

describe("POST /api/custom-roles", () => {
  let handler: typeof import("@/app/api/custom-roles/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/custom-roles/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/custom-roles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "post-test-1",
      },
      body: JSON.stringify({ name: "Custom Role" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 501 Not Implemented for admin on business plan", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "BUSINESS",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/custom-roles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "post-test-2",
      },
      body: JSON.stringify({ name: "Custom Role", permissions: ["shifts.*"] }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(501);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
