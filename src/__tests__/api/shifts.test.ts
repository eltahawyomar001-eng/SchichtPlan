/**
 * @vitest-environment node
 *
 * Tests for the Shifts API:
 *   GET  /api/shifts — list shifts
 *   POST /api/shifts — create shift
 *
 * Shift planning is the core feature of the app. Tests cover
 * auth, employee-only-own scoping, conflict detection, and
 * surcharge calculation wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ── */
const {
  mockSession,
  mockShiftFindMany,
  mockShiftCount,
  mockShiftCreate,
  mockCheckConflicts,
  mockWorkspaceFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockShiftFindMany: vi.fn(),
  mockShiftCount: vi.fn(),
  mockShiftCreate: vi.fn(),
  mockCheckConflicts: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/db", () => {
  const tx = {
    shift: {
      findMany: mockShiftFindMany,
      count: mockShiftCount,
      create: mockShiftCreate,
    },
    workspace: {
      findUnique: mockWorkspaceFindUnique,
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
  return {
    prisma: {
      ...tx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn((cb: (t: any) => Promise<any>) => cb(tx)),
    },
  };
});

// Re-export the workspace mock so that outer prisma.workspace?.findUnique
// picks it up correctly (used for Bundesland lookup outside the tx).

vi.mock("@/lib/automations", () => ({
  checkShiftConflicts: (...args: unknown[]) => mockCheckConflicts(...args),
  createRecurringShifts: vi.fn().mockResolvedValue(null),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
  executeCustomRules: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/holidays", () => ({
  isPublicHoliday: vi.fn().mockReturnValue({ isHoliday: false }),
  isSunday: vi.fn().mockReturnValue(false),
  isNightShift: vi.fn().mockReturnValue(false),
  calculateSurcharge: vi.fn().mockReturnValue(0),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogTx: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

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

import { buildAdmin, buildManager, buildEmployee } from "../helpers/factories";

/* ── Helpers ── */
function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/shifts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validShift = {
  date: "2025-03-10",
  startTime: "08:00",
  endTime: "16:00",
  employeeId: "emp-1",
};

/* ══════════════════════════════════════════════════════════════════
   GET /api/shifts
   ══════════════════════════════════════════════════════════════════ */

describe("GET /api/shifts", () => {
  let handler: typeof import("@/app/api/shifts/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shifts/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/shifts"));
    expect(res.status).toBe(401);
  });

  it("returns shifts for admin", async () => {
    mockSession.user = buildAdmin();
    mockShiftFindMany.mockResolvedValue([
      { id: "s-1", date: "2025-03-10", startTime: "08:00", endTime: "16:00" },
    ]);
    mockShiftCount.mockResolvedValue(1);

    const res = await handler.GET(new Request("http://localhost/api/shifts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("EMPLOYEE only sees own shifts", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockShiftFindMany.mockResolvedValue([]);
    mockShiftCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/shifts"));
    const findCall = mockShiftFindMany.mock.calls[0][0];
    expect(findCall.where.employeeId).toBe("emp-1");
  });

  it("filters by date range", async () => {
    mockSession.user = buildAdmin();
    mockShiftFindMany.mockResolvedValue([]);
    mockShiftCount.mockResolvedValue(0);

    await handler.GET(
      new Request(
        "http://localhost/api/shifts?start=2025-03-01&end=2025-03-31",
      ),
    );

    const findCall = mockShiftFindMany.mock.calls[0][0];
    expect(findCall.where.date.gte).toBeInstanceOf(Date);
    expect(findCall.where.date.lte).toBeInstanceOf(Date);
  });
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/shifts
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/shifts", () => {
  let handler: typeof import("@/app/api/shifts/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckConflicts.mockResolvedValue([]);
    mockWorkspaceFindUnique.mockResolvedValue({ bundesland: "HE" });
    handler = await import("@/app/api/shifts/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq(validShift));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create shift", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    const res = await handler.POST(postReq(validShift));
    expect(res.status).toBe(403);
  });

  it("creates a shift successfully", async () => {
    mockSession.user = buildAdmin();
    const created = {
      id: "s-1",
      ...validShift,
      status: "SCHEDULED",
      employee: { firstName: "Max", lastName: "M", email: "m@t.de" },
    };
    mockShiftCreate.mockResolvedValue(created);

    const res = await handler.POST(postReq(validShift));
    expect(res.status).toBe(201);
    expect(mockShiftCreate).toHaveBeenCalledOnce();
  });

  it("creates an open shift (no employee) with status OPEN", async () => {
    mockSession.user = buildManager();
    const created = {
      id: "s-1",
      date: "2025-03-10",
      startTime: "08:00",
      endTime: "16:00",
      status: "OPEN",
      employee: null,
    };
    mockShiftCreate.mockResolvedValue(created);

    const res = await handler.POST(
      postReq({
        date: "2025-03-10",
        startTime: "08:00",
        endTime: "16:00",
      }),
    );
    expect(res.status).toBe(201);
    const createCall = mockShiftCreate.mock.calls[0][0];
    expect(createCall.data.status).toBe("OPEN");
    expect(createCall.data.employeeId).toBeNull();
  });

  it("returns 409 when conflict is detected", async () => {
    mockSession.user = buildAdmin();
    mockCheckConflicts.mockResolvedValue([
      { id: "conflict-1", date: "2025-03-10" },
    ]);

    const res = await handler.POST(postReq(validShift));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Conflicts detected");
    expect(body.conflicts).toHaveLength(1);
  });

  it("returns 400 for missing required date", async () => {
    mockSession.user = buildAdmin();
    const res = await handler.POST(
      postReq({ startTime: "08:00", endTime: "16:00" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid time format", async () => {
    mockSession.user = buildAdmin();
    const res = await handler.POST(
      postReq({ ...validShift, startTime: "8AM" }),
    );
    expect(res.status).toBe(400);
  });

  it("MANAGER can create shifts", async () => {
    mockSession.user = buildManager();
    mockShiftCreate.mockResolvedValue({
      id: "s-1",
      ...validShift,
      status: "SCHEDULED",
      employee: { firstName: "Max", lastName: "M", email: "m@t.de" },
    });

    const res = await handler.POST(postReq(validShift));
    expect(res.status).toBe(201);
  });

  it("skips conflict check when no employeeId is provided", async () => {
    mockSession.user = buildAdmin();
    mockShiftCreate.mockResolvedValue({
      id: "s-1",
      status: "OPEN",
      employee: null,
    });

    await handler.POST(
      postReq({
        date: "2025-03-10",
        startTime: "08:00",
        endTime: "16:00",
      }),
    );

    expect(mockCheckConflicts).not.toHaveBeenCalled();
  });
});
