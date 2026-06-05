/**
 * @vitest-environment node
 *
 * Tests for GET /api/time-entries/punch-log
 *
 * Returns live-clock time entries. Employees see only their own entries
 * (DSGVO scoping); managers see the full workspace.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindMany } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindMany: vi.fn(),
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
  prisma: { timeEntry: { findMany: mockFindMany } },
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
  name: "Mgr",
};
const emp: SessionUser = {
  ...manager,
  id: "u2",
  email: "emp@test.com",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const sampleEntry = {
  id: "te1",
  clockInAt: new Date(),
  clockOutAt: null,
  date: new Date(),
  employee: { firstName: "A", lastName: "B" },
};

describe("GET /api/time-entries/punch-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/time-entries/punch-log/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/punch-log"),
    );
    expect(res.status).toBe(401);
  });

  it("returns entries array for manager", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([sampleEntry]);
    const { GET } = await import("@/app/api/time-entries/punch-log/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/punch-log"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
  });

  it("scopes employee to their own entries", async () => {
    mockSession.user = emp;
    mockFindMany.mockResolvedValue([sampleEntry]);
    const { GET } = await import("@/app/api/time-entries/punch-log/route");
    await GET(new Request("http://localhost/api/time-entries/punch-log"));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: "emp1" }),
      }),
    );
  });

  it("manager query does not include employeeId filter", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/punch-log/route");
    await GET(new Request("http://localhost/api/time-entries/punch-log"));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.employeeId).toBeUndefined();
  });

  it("respects limit query param", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/punch-log/route");
    await GET(
      new Request("http://localhost/api/time-entries/punch-log?limit=10"),
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
