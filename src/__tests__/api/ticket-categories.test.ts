/**
 * @vitest-environment node
 *
 * Tests for GET / POST /api/ticket-categories
 *
 * GET: any authenticated member. POST: OWNER/ADMIN only.
 * POST creates a category with a slugified name; handles slug collisions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockFindMany,
  mockFindUnique,
  mockCreate,
  mockEnsureDefaults,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockEnsureDefaults: vi.fn().mockResolvedValue(undefined),
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
    ticketCategoryDef: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));
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
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId,
      };
    }),
  };
});
vi.mock("@/lib/ticket-categories", () => ({
  ensureDefaultCategories: mockEnsureDefaults,
  slugifyCategoryName: (name: string) =>
    name.toLowerCase().replace(/\s+/g, "-"),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    withRequestId: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const admin: SessionUser = {
  id: "u1",
  email: "admin@test.com",
  workspaceId: "ws1",
  role: "ADMIN",
  employeeId: null,
  name: "Admin",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };
const emp: SessionUser = {
  ...admin,
  id: "u3",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const categories = [
  {
    id: "cat1",
    name: "Bug",
    slug: "bug",
    color: "#f00",
    sortOrder: 10,
    legacyEnum: null,
  },
];

describe("GET /api/ticket-categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/ticket-categories/route");
    const res = await GET(
      new Request("http://localhost/api/ticket-categories"),
    );
    expect(res.status).toBe(401);
  });

  it("returns categories for any authenticated user", async () => {
    mockSession.user = emp;
    mockFindMany.mockResolvedValue(categories);
    const { GET } = await import("@/app/api/ticket-categories/route");
    const res = await GET(
      new Request("http://localhost/api/ticket-categories"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories).toHaveLength(1);
    expect(body.categories[0].name).toBe("Bug");
    expect(mockEnsureDefaults).toHaveBeenCalledWith("ws1");
  });
});

describe("POST /api/ticket-categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFindUnique.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/ticket-categories/route");
    const res = await POST(
      new Request("http://localhost/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/ticket-categories/route");
    const res = await POST(
      new Request("http://localhost/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    mockSession.user = admin;
    const { POST } = await import("@/app/api/ticket-categories/route");
    const res = await POST(
      new Request("http://localhost/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates category and returns 201", async () => {
    mockSession.user = admin;
    const created = {
      id: "cat2",
      name: "Feature",
      slug: "feature",
      color: null,
      sortOrder: 1000,
      legacyEnum: null,
    };
    mockCreate.mockResolvedValue(created);
    const { POST } = await import("@/app/api/ticket-categories/route");
    const res = await POST(
      new Request("http://localhost/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Feature" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Feature");
  });
});
