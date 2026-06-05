/**
 * @vitest-environment node
 *
 * Tests for POST /api/time-entries/clock/create-profile
 *
 * Self-creates an Employee record for a management user who doesn't have one,
 * so they can use the Stempeluhr. Links the new employee to the user account.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockEmployeeFindUnique,
  mockEmployeeFindFirst,
  mockTransaction,
  mockCacheDel,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockEmployeeFindUnique: vi.fn(),
  mockEmployeeFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockCacheDel: vi.fn().mockResolvedValue(undefined),
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
    employee: {
      findUnique: mockEmployeeFindUnique,
      findFirst: mockEmployeeFindFirst,
    },
    $transaction: mockTransaction,
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
vi.mock("@/lib/cache", () => ({ cache: { del: mockCacheDel } }));
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

const manager: SessionUser = {
  id: "u1",
  email: "mgr@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "Manager Test",
};
const emp: SessionUser = {
  ...manager,
  id: "u2",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

describe("POST /api/time-entries/clock/create-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } =
      await import("@/app/api/time-entries/clock/create-profile/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by an employee (non-management role)", async () => {
    mockSession.user = emp;
    const { POST } =
      await import("@/app/api/time-entries/clock/create-profile/route");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 409 when manager already has a linked employee (session)", async () => {
    mockSession.user = { ...manager, employeeId: "emp-exists" };
    const { POST } =
      await import("@/app/api/time-entries/clock/create-profile/route");
    const res = await POST();
    expect(res.status).toBe(409);
  });

  it("returns existing employee if DB already has a link (stale session)", async () => {
    mockSession.user = manager; // session says no employeeId
    mockEmployeeFindUnique.mockResolvedValue({ id: "emp-existing" }); // but DB has one
    const { POST } =
      await import("@/app/api/time-entries/clock/create-profile/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.employeeId).toBe("emp-existing");
    expect(mockCacheDel).toHaveBeenCalled();
  });

  it("creates a new employee profile and returns 201", async () => {
    mockSession.user = manager;
    mockEmployeeFindUnique.mockResolvedValue(null); // no existing link
    const newEmp = { id: "emp-new", firstName: "Manager", lastName: "Test" };
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          employee: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newEmp),
            update: vi.fn().mockResolvedValue(newEmp),
          },
        };
        return fn(tx);
      },
    );
    const { POST } =
      await import("@/app/api/time-entries/clock/create-profile/route");
    const res = await POST();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.employeeId).toBe("emp-new");
    expect(mockCacheDel).toHaveBeenCalled();
  });
});
