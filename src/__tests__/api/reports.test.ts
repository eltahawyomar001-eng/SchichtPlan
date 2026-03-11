/**
 * @vitest-environment node
 *
 * Tests for Reports API:
 *   GET /api/reports — get aggregated reporting data
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockShiftFindMany,
  mockEmployeeFindMany,
  mockRequirePlanFeature,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockShiftFindMany: vi.fn(),
  mockEmployeeFindMany: vi.fn(),
  mockRequirePlanFeature: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    shift: { findMany: mockShiftFindMany },
    employee: { findMany: mockEmployeeFindMany },
    absenceRequest: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    timeEntry: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { netMinutes: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock("@/lib/subscription", () => ({
  requirePlanFeature: mockRequirePlanFeature,
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/reports", () => {
  let handler: typeof import("@/app/api/reports/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/reports/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/reports"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to access", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.GET(new Request("http://localhost/api/reports"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when plan does not support analytics", async () => {
    mockSession.user = buildAdmin();
    const { NextResponse } = await import("next/server");
    mockRequirePlanFeature.mockResolvedValue(
      NextResponse.json(
        { error: "Plan does not support this feature" },
        { status: 403 },
      ),
    );

    const res = await handler.GET(new Request("http://localhost/api/reports"));
    expect(res.status).toBe(403);
  });

  it("returns reports for admin with plan feature", async () => {
    mockSession.user = buildAdmin();
    mockRequirePlanFeature.mockResolvedValue(null);
    mockShiftFindMany.mockResolvedValue([
      {
        id: "s1",
        startTime: "08:00",
        endTime: "16:00",
        status: "COMPLETED",
        employeeId: "emp-1",
        employee: { id: "emp-1", firstName: "Max", lastName: "M" },
      },
    ]);
    mockEmployeeFindMany.mockResolvedValue([
      { id: "emp-1", firstName: "Max", lastName: "M", isActive: true },
    ]);

    const res = await handler.GET(
      new Request(
        "http://localhost/api/reports?start=2025-01-01&end=2025-01-31",
      ),
    );
    expect(res.status).toBe(200);
  });
});
