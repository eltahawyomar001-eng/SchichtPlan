/**
 * Regression tests for GET /api/tickets/assignees
 *
 * Bug fixed: the ticket detail page was calling /api/team and filtering to
 * OWNER/ADMIN/MANAGER roles only, so EMPLOYEE-role users could never be
 * assigned to tickets.  The dedicated /api/tickets/assignees endpoint
 * intentionally returns all roles — these tests guard against that regression.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted shared state ──────────────────────────────────── */

const { mockSession, mockUserFindMany } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUserFindMany: vi.fn(),
}));

/* ── Module mocks ──────────────────────────────────────────── */

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
    user: {
      findMany: mockUserFindMany,
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

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

/* ── Factories ─────────────────────────────────────────────── */

import { buildOwner, buildEmployee, buildManager } from "../helpers/factories";

/* ── Tests ─────────────────────────────────────────────────── */

describe("GET /api/tickets/assignees", () => {
  let handler: typeof import("@/app/api/tickets/assignees/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/tickets/assignees/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/tickets/assignees"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 for OWNER with tickets:read permission", async () => {
    mockSession.user = buildOwner();
    mockUserFindMany.mockResolvedValue([]);
    const res = await handler.GET(
      new Request("http://localhost/api/tickets/assignees"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 for EMPLOYEE — all roles have tickets:read permission", async () => {
    // Regression guard: EMPLOYEE has tickets:read in the permission matrix.
    // This endpoint must NOT return 403 for employees (unlike /api/team which
    // filtered by role client-side and excluded EMPLOYEE from the dropdown).
    mockSession.user = buildEmployee();
    mockUserFindMany.mockResolvedValue([]);
    const res = await handler.GET(
      new Request("http://localhost/api/tickets/assignees"),
    );
    expect(res.status).toBe(200);
  });

  it("includes EMPLOYEE-role users in the assignee list", async () => {
    // Core regression: the /api/team endpoint filtered to OWNER/ADMIN/MANAGER
    // in the UI, so EMPLOYEE users never appeared in the assignee dropdown.
    // This endpoint must return EMPLOYEE-role members.
    const owner = buildOwner();
    mockSession.user = owner;

    const employeeUser = {
      id: "emp-1",
      name: "Alice Employee",
      email: "alice@example.com",
      role: "EMPLOYEE",
    };
    const managerUser = {
      id: "mgr-1",
      name: "Bob Manager",
      email: "bob@example.com",
      role: "MANAGER",
    };

    mockUserFindMany.mockResolvedValue([managerUser, employeeUser]);

    const res = await handler.GET(
      new Request("http://localhost/api/tickets/assignees"),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      assignees: { id: string; role: string }[];
    };
    const roles = body.assignees.map((u) => u.role);
    expect(roles).toContain("EMPLOYEE");
    expect(roles).toContain("MANAGER");
  });

  it("scopes results to the current user's workspace", async () => {
    const owner = buildOwner({ workspaceId: "ws-abc" });
    mockSession.user = owner;
    mockUserFindMany.mockResolvedValue([]);

    await handler.GET(new Request("http://localhost/api/tickets/assignees"));

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws-abc" }),
      }),
    );
  });

  it("does not leak members from a different workspace", async () => {
    // The workspace scope must be enforced so users from workspace A cannot
    // see teammates from workspace B as potential assignees.
    const manager = buildManager({ workspaceId: "ws-team-a" });
    mockSession.user = manager;
    mockUserFindMany.mockResolvedValue([]);

    await handler.GET(new Request("http://localhost/api/tickets/assignees"));

    const [callArg] = mockUserFindMany.mock.calls[0] as [
      { where: { workspaceId: string } },
    ];
    expect(callArg.where.workspaceId).toBe("ws-team-a");
  });

  it("returns assignees with id, name, email and role fields", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    const user = {
      id: "u-1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
    };
    mockUserFindMany.mockResolvedValue([user]);

    const res = await handler.GET(
      new Request("http://localhost/api/tickets/assignees"),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { assignees: (typeof user)[] };
    expect(body.assignees).toHaveLength(1);
    expect(body.assignees[0]).toMatchObject({
      id: "u-1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
    });
  });
});
