/**
 * @vitest-environment node
 *
 * Tests for POST /api/absences/preview
 *
 * Stateless dry-run that shows which calendar days will be deducted
 * for a given absence date range (weekends and holidays excluded).
 * Tests cover: auth, employee scope, date validation, employee lookup,
 * and successful classification response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockEmployeeFindFirst, mockClassify } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockEmployeeFindFirst: vi.fn(),
  mockClassify: vi.fn(),
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
    employee: { findFirst: mockEmployeeFindFirst },
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
vi.mock("@/lib/absence-days", () => ({
  classifyAbsenceForWorkspace: mockClassify,
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

const EMP_CUID = "clxbbbbbbbbbbbbbbbbbbbbbb";

const employee: SessionUser = {
  id: "u2",
  email: "emp@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: EMP_CUID,
  name: "Emp",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

function makeReq(body: object) {
  return new Request("http://localhost/api/absences/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  employeeId: "clxaaaaaaaaaaaaaaaaaaaaa",
  startDate: "2026-07-01",
  endDate: "2026-07-05",
};

describe("POST /api/absences/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockEmployeeFindFirst.mockResolvedValue({
      id: validBody.employeeId,
      locationId: null,
    });
    mockClassify.mockResolvedValue({
      workDays: 5,
      holidayDays: 0,
      weekendDays: 0,
      totalDays: 5,
      days: [],
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/absences/preview/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when request body is invalid", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/absences/preview/route");
    const res = await POST(
      makeReq({
        employeeId: "not-a-cuid",
        startDate: "2026-07-01",
        endDate: "2026-07-05",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when endDate is before startDate", async () => {
    mockSession.user = manager;
    mockEmployeeFindFirst.mockResolvedValue({
      id: validBody.employeeId,
      locationId: null,
    });
    const { POST } = await import("@/app/api/absences/preview/route");
    const res = await POST(
      makeReq({ ...validBody, startDate: "2026-07-10", endDate: "2026-07-05" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_RANGE");
  });

  it("returns 403 when employee requests preview for another employee", async () => {
    mockSession.user = employee;
    const { POST } = await import("@/app/api/absences/preview/route");
    const res = await POST(
      makeReq({ ...validBody, employeeId: "clxbbbbbbbbbbbbbbbbbbbbb" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN_EMPLOYEE");
  });

  it("returns 404 when employee does not exist in workspace", async () => {
    mockSession.user = manager;
    mockEmployeeFindFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/absences/preview/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("EMPLOYEE_NOT_FOUND");
  });

  it("returns classification result for a manager request", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/absences/preview/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workDays).toBe(5);
    expect(mockClassify).toHaveBeenCalledOnce();
  });

  it("allows employee to preview their own absence", async () => {
    mockSession.user = employee;
    mockEmployeeFindFirst.mockResolvedValue({ id: EMP_CUID, locationId: null });
    mockClassify.mockResolvedValue({
      workDays: 3,
      holidayDays: 0,
      weekendDays: 2,
      totalDays: 5,
      days: [],
    });
    const { POST } = await import("@/app/api/absences/preview/route");
    // employeeId matches employee.employeeId
    const res = await POST(makeReq({ ...validBody, employeeId: EMP_CUID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workDays).toBe(3);
  });
});
