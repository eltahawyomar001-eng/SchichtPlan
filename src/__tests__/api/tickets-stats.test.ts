/**
 * @vitest-environment node
 *
 * Tests for GET /api/tickets/stats
 * Returns ticket count breakdowns by status, category, and priority.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockTicketCount, mockTicketGroupBy } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockTicketCount: vi.fn(),
  mockTicketGroupBy: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
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
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: {
      count: mockTicketCount,
      groupBy: mockTicketGroupBy,
    },
  },
}));
vi.mock("@/lib/ticketing-addon", () => ({
  requireTicketingAddon: vi.fn().mockResolvedValue(null),
}));
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
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));

import { buildOwner, buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/tickets/stats", () => {
  let handler: typeof import("@/app/api/tickets/stats/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/tickets/stats/route");
    // Default counts
    mockTicketCount.mockResolvedValue(0);
    mockTicketGroupBy.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct shape for admin", async () => {
    mockSession.user = buildAdmin();
    mockTicketCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(5) // open
      .mockResolvedValueOnce(3) // in progress
      .mockResolvedValueOnce(2); // closed
    mockTicketGroupBy
      .mockResolvedValueOnce([
        { category: "TECHNIK", _count: { _all: 4 } },
        { category: "HR", _count: { _all: 6 } },
      ])
      .mockResolvedValueOnce([
        { priority: "HOCH", _count: { _all: 3 } },
        { priority: "MITTEL", _count: { _all: 5 } },
      ]);

    const res = await handler.GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(10);
    // Route returns byStatus object, not top-level open/inProgress/closed
    expect(body.byStatus.OFFEN).toBe(5);
    expect(body.byStatus.IN_BEARBEITUNG).toBe(3);
    expect(body.byStatus.GESCHLOSSEN).toBe(2);
    expect(Object.keys(body.byCategory)).toHaveLength(2);
    expect(Object.keys(body.byPriority)).toHaveLength(2);
  });

  it("returns 200 with all zeros when workspace has no tickets", async () => {
    mockSession.user = buildAdmin();
    mockTicketCount.mockResolvedValue(0);
    mockTicketGroupBy.mockResolvedValue([]);

    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.byStatus.OFFEN).toBe(0);
  });

  it("scopes EMPLOYEE stats to own tickets only", async () => {
    const emp = buildEmployee({ id: "emp-user-1" });
    mockSession.user = emp;
    mockTicketCount.mockResolvedValue(3);
    mockTicketGroupBy.mockResolvedValue([]);

    await handler.GET();

    // All count queries should include the OR scope
    const firstCallWhere = mockTicketCount.mock.calls[0][0].where;
    expect(firstCallWhere.OR).toEqual([
      { createdById: "emp-user-1" },
      { assignedToId: "emp-user-1" },
    ]);
  });

  it("scopes queries to the user's workspaceId", async () => {
    const admin = buildAdmin({ workspaceId: "ws-specific" });
    mockSession.user = admin;
    mockTicketCount.mockResolvedValue(0);
    mockTicketGroupBy.mockResolvedValue([]);

    await handler.GET();

    const firstCallWhere = mockTicketCount.mock.calls[0][0].where;
    expect(firstCallWhere.workspaceId).toBe("ws-specific");
  });

  it("OWNER gets full workspace stats (no OR scope)", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockTicketCount.mockResolvedValue(50);
    mockTicketGroupBy.mockResolvedValue([]);

    await handler.GET();

    const firstCallWhere = mockTicketCount.mock.calls[0][0].where;
    expect(firstCallWhere.OR).toBeUndefined();
    expect(firstCallWhere.workspaceId).toBe(owner.workspaceId);
  });
});
