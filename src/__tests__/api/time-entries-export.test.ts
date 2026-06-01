/**
 * @vitest-environment node
 *
 * Tests for GET /api/time-entries/export
 *
 * CSV export of time entries. Only available to managers+.
 * Tests cover: auth, role gating (employee forbidden), empty result,
 * and that the response is a valid CSV text/plain or text/csv response.
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
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
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
vi.mock("@/i18n/locale", () => ({
  getLocaleFromCookie: vi.fn().mockResolvedValue("de"),
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

const manager: SessionUser = {
  id: "u1",
  email: "mgr@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "Manager",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const empUser: SessionUser = {
  id: "u2",
  email: "emp@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "emp1",
  name: "Emp",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

const sampleEntry = {
  id: "te1",
  date: new Date("2026-05-01"),
  startTime: "08:00",
  endTime: "16:00",
  grossMinutes: 480,
  netMinutes: 450,
  breakMinutes: 30,
  breakStart: null,
  breakEnd: null,
  status: "BESTAETIGT",
  confirmedBy: null,
  confirmedAt: null,
  employee: { firstName: "Anna", lastName: "Schmidt" },
  location: { name: "Hauptstandort" },
};

describe("GET /api/time-entries/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/time-entries/export/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/export"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by an employee", async () => {
    mockSession.user = empUser;
    const { GET } = await import("@/app/api/time-entries/export/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/export"),
    );
    expect(res.status).toBe(403);
  });

  it("returns CSV with header row when no entries match", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/time-entries/export/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/export"),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    // Should contain at least one semicolon (CSV separator) in the header
    expect(text).toContain(";");
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType.toLowerCase()).toMatch(/text/);
  });

  it("includes employee data rows in CSV", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([sampleEntry]);
    const { GET } = await import("@/app/api/time-entries/export/route");
    const res = await GET(
      new Request(
        "http://localhost/api/time-entries/export?start=2026-05-01&end=2026-05-31",
      ),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Schmidt");
    expect(text).toContain("Anna");
  });

  it("filters by employeeId query param", async () => {
    mockSession.user = manager;
    mockFindMany.mockResolvedValue([sampleEntry]);
    const { GET } = await import("@/app/api/time-entries/export/route");
    await GET(
      new Request("http://localhost/api/time-entries/export?employeeId=emp1"),
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: "emp1" }),
      }),
    );
  });
});
