/**
 * @vitest-environment node
 *
 * Tests for Shift Swaps API:
 *   GET  /api/shift-swaps — list shift swap requests
 *   POST /api/shift-swaps — create shift swap request
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockSwapFindMany,
  mockSwapCount,
  mockSwapCreate,
  mockShiftFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockSwapFindMany: vi.fn(),
  mockSwapCount: vi.fn(),
  mockSwapCreate: vi.fn(),
  mockShiftFindUnique: vi.fn(),
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
    shiftSwapRequest: {
      findMany: mockSwapFindMany,
      count: mockSwapCount,
      create: mockSwapCreate,
    },
    shift: {
      findUnique: mockShiftFindUnique,
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  },
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/automations", () => ({
  checkShiftConflicts: vi.fn().mockResolvedValue([]),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn().mockReturnValue({ take: 50, skip: 0 }),
  paginatedResponse: vi.fn(
    async (items: unknown[], total: number, take: number, skip: number) => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ data: items, total, take, skip });
    },
  ),
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/shift-swaps", () => {
  let handler: typeof import("@/app/api/shift-swaps/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-swaps/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/shift-swaps"),
    );
    expect(res.status).toBe(401);
  });

  it("returns swap requests for admin", async () => {
    mockSession.user = buildAdmin();
    mockSwapFindMany.mockResolvedValue([{ id: "sw1", status: "AUSSTEHEND" }]);
    mockSwapCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/shift-swaps"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("EMPLOYEE only sees own swap requests (requester or target)", async () => {
    mockSession.user = buildEmployee({ employeeId: "emp-1" });
    mockSwapFindMany.mockResolvedValue([]);
    mockSwapCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/shift-swaps"));
    const call = mockSwapFindMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requesterId: "emp-1" }),
        expect.objectContaining({ targetId: "emp-1" }),
      ]),
    );
  });
});

describe("POST /api/shift-swaps", () => {
  let handler: typeof import("@/app/api/shift-swaps/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-swaps/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      new Request("http://localhost/api/shift-swaps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shiftId: "s1",
          targetId: "emp-2",
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    mockSession.user = buildAdmin();
    const res = await handler.POST(
      new Request("http://localhost/api/shift-swaps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});
