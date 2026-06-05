/**
 * @vitest-environment node
 *
 * Tests for GET /api/time-entries/export/datev
 *
 * Exports time entries as a DATEV-compatible CSV.
 * Requires time-entries:read permission. Missing/invalid month → 400.
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
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const sampleEntry = {
  id: "te1",
  date: new Date("2026-05-15"),
  startTime: "08:00",
  endTime: "16:00",
  breakMinutes: 30,
  netMinutes: 450,
  grossMinutes: 480,
  remarks: null,
  employee: { id: "emp1", firstName: "Anna", lastName: "Schmidt" },
};

describe("GET /api/time-entries/export/datev", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/time-entries/export/datev/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/export/datev?month=2026-05",
      ),
    );
    expect(res.status).toBe(401);
  });

  it("allows employees to access (time-entries:read is granted to all roles)", async () => {
    mockSession.user = emp;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/export/datev/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/export/datev?month=2026-05",
      ),
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when month param is missing", async () => {
    mockSession.user = manager;
    const { GET } = await import("@/app/api/time-entries/export/datev/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/export/datev"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_MONTH");
  });

  it("returns 400 when month format is invalid", async () => {
    mockSession.user = manager;
    const { GET } = await import("@/app/api/time-entries/export/datev/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/export/datev?month=May-2026",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns CSV with DATEV header for empty result", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/export/datev/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/export/datev?month=2026-05",
      ),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    // DATEV CSV uses semicolons
    expect(text).toContain(";");
    expect(text).toMatch(/Mitarbeiter/i);
  });

  it("includes employee data in CSV rows", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([sampleEntry]);
    const { GET } = await import("@/app/api/time-entries/export/datev/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/export/datev?month=2026-05",
      ),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Schmidt");
  });
});
