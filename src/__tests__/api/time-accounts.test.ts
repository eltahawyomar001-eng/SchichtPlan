/**
 * @vitest-environment node
 *
 * Tests for Time Accounts API:
 *   GET /api/time-accounts — list time accounts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockTimeAccountFindMany, mockTimeEntryAggregate } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockTimeAccountFindMany: vi.fn(),
    mockTimeEntryAggregate: vi.fn(),
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
    timeAccount: {
      findMany: mockTimeAccountFindMany,
    },
    timeEntry: {
      aggregate: mockTimeEntryAggregate,
    },
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/time-accounts", () => {
  let handler: typeof import("@/app/api/time-accounts/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/time-accounts/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/time-accounts"),
    );
    expect(res.status).toBe(401);
  });

  it("returns time accounts for admin", async () => {
    mockSession.user = buildAdmin();
    mockTimeAccountFindMany.mockResolvedValue([
      {
        id: "ta1",
        employeeId: "emp-1",
        contractHours: 40,
        carryoverMinutes: 0,
        periodStart: new Date("2025-01-01"),
      },
    ]);
    mockTimeEntryAggregate.mockResolvedValue({
      _sum: { netMinutes: 2400 },
    });

    const res = await handler.GET(
      new Request("http://localhost/api/time-accounts"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].workedMinutes).toBeDefined();
  });

  it("EMPLOYEE only sees own time account", async () => {
    mockSession.user = buildEmployee({ employeeId: "emp-1" });
    mockTimeAccountFindMany.mockResolvedValue([]);

    await handler.GET(new Request("http://localhost/api/time-accounts"));
    const call = mockTimeAccountFindMany.mock.calls[0][0];
    expect(call.where.employeeId).toBe("emp-1");
  });

  it("returns 400 when user has no workspaceId", async () => {
    mockSession.user = buildAdmin({ workspaceId: "" as string });
    const res = await handler.GET(
      new Request("http://localhost/api/time-accounts"),
    );
    expect(res.status).toBe(400);
  });
});
