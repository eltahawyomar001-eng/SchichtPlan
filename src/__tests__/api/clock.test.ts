/**
 * @vitest-environment node
 *
 * Tests for the clock-in/out endpoint: POST /api/time-entries/clock
 *
 * The most critical flow in the application — payroll-relevant.
 * Covers: clock-in, clock-out, break-start, break-end,
 * race condition prevention (ALREADY_CLOCKED_IN),
 * NOT_CLOCKED_IN, NO_ACTIVE_BREAK, BREAK_ALREADY_ACTIVE,
 * ArbZG legal break enforcement on clock-out.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ── */
const {
  mockSession,
  mockTimeEntryFindFirst,
  mockTimeEntryCreate,
  mockTimeEntryUpdate,
  mockTimeEntryFindMany,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockTimeEntryFindFirst: vi.fn(),
  mockTimeEntryCreate: vi.fn(),
  mockTimeEntryUpdate: vi.fn(),
  mockTimeEntryFindMany: vi.fn(),
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
    timeEntry: {
      findFirst: mockTimeEntryFindFirst,
      create: mockTimeEntryCreate,
      update: mockTimeEntryUpdate,
      findMany: mockTimeEntryFindMany,
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

vi.mock("@/lib/automations", () => ({
  ensureLegalBreak: vi.fn(
    (grossMinutes: number, providedBreak: number): number => {
      // Replicate ArbZG logic: >6h → 30min, >9h → 45min
      let legalMin = 0;
      if (grossMinutes > 540) legalMin = 45;
      else if (grossMinutes > 360) legalMin = 30;
      return Math.max(providedBreak, legalMin);
    },
  ),
  executeCustomRules: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildEmployee, buildOwner } from "../helpers/factories";

/* ── Helper ── */
function clockReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/time-entries/clock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ══════════════════════════════════════════════════════════════════
   POST /api/time-entries/clock
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/time-entries/clock", () => {
  let handler: typeof import("@/app/api/time-entries/clock/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/time-entries/clock/route");
  });

  // ── Auth ──

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(clockReq({ action: "in" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when user has no employeeId", async () => {
    mockSession.user = buildOwner({ employeeId: null });
    const res = await handler.POST(clockReq({ action: "in" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("NO_EMPLOYEE_PROFILE");
  });

  // ── Validation ──

  it("returns 400 for invalid action", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    const res = await handler.POST(clockReq({ action: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing action", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    const res = await handler.POST(clockReq({}));
    expect(res.status).toBe(400);
  });

  // ── Clock In ──

  it("creates a time entry on clock-in", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue(null); // no open entry
    const created = {
      id: "te-1",
      employeeId: "emp-1",
      isLiveClock: true,
      status: "ENTWURF",
    };
    mockTimeEntryCreate.mockResolvedValue(created);

    const res = await handler.POST(clockReq({ action: "in" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("te-1");
    expect(mockTimeEntryCreate).toHaveBeenCalledOnce();
  });

  it("returns 409 ALREADY_CLOCKED_IN when there is an open entry", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    // Simulate the transaction finding an open entry and throwing
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-existing",
      clockOutAt: null,
    });

    const res = await handler.POST(clockReq({ action: "in" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("ALREADY_CLOCKED_IN");
    expect(body.entryId).toBe("te-existing");
  });

  // ── Break Start ──

  it("starts a break successfully", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      breakStart: null,
      breakEnd: null,
      clockOutAt: null,
    });
    mockTimeEntryUpdate.mockResolvedValue({
      id: "te-1",
      breakStart: "12:00",
    });

    const res = await handler.POST(clockReq({ action: "break-start" }));
    expect(res.status).toBe(200);
    expect(mockTimeEntryUpdate).toHaveBeenCalledOnce();
  });

  it("returns 404 NOT_CLOCKED_IN when starting break without open entry", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue(null);

    const res = await handler.POST(clockReq({ action: "break-start" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_CLOCKED_IN");
  });

  it("returns 409 BREAK_ALREADY_ACTIVE when break is in progress", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      breakStart: "12:00",
      breakEnd: null, // break still active
      clockOutAt: null,
    });

    const res = await handler.POST(clockReq({ action: "break-start" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("BREAK_ALREADY_ACTIVE");
  });

  // ── Break End ──

  it("ends a break successfully and calculates break minutes", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      breakStart: "12:00",
      breakEnd: null,
      clockOutAt: null,
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ id: "te-1", ...args.data }),
    );

    const res = await handler.POST(clockReq({ action: "break-end" }));
    expect(res.status).toBe(200);
    expect(mockTimeEntryUpdate).toHaveBeenCalledOnce();
    // breakMinutes should be calculated
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.breakMinutes).toBeTypeOf("number");
    expect(updateCall.data.breakMinutes).toBeGreaterThanOrEqual(0);
  });

  it("returns 404 NO_ACTIVE_BREAK when ending break without one", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue(null);

    const res = await handler.POST(clockReq({ action: "break-end" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NO_ACTIVE_BREAK");
  });

  // ── Clock Out ──

  it("clocks out successfully and calculates gross/net minutes", async () => {
    const clockInTime = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8h ago
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      clockInAt: clockInTime,
      breakStart: "12:00",
      breakEnd: "12:30",
      breakMinutes: 30,
      clockOutAt: null,
      startTime: "08:00",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({
        id: "te-1",
        ...args.data,
        startTime: "08:00",
      }),
    );

    const res = await handler.POST(clockReq({ action: "out" }));
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.clockOutAt).toBeInstanceOf(Date);
    expect(updateCall.data.grossMinutes).toBeTypeOf("number");
    expect(updateCall.data.netMinutes).toBeTypeOf("number");
    // ArbZG: 8h work → 30 min legal break minimum enforced
    expect(updateCall.data.breakMinutes).toBeGreaterThanOrEqual(30);
  });

  it("returns 404 NOT_CLOCKED_IN on clock-out without open entry", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue(null);

    const res = await handler.POST(clockReq({ action: "out" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_CLOCKED_IN");
  });

  it("auto-ends an active break on clock-out", async () => {
    const clockInTime = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4h ago
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      clockInAt: clockInTime,
      breakStart: "12:00",
      breakEnd: null, // break still running
      breakMinutes: 0,
      clockOutAt: null,
      startTime: "10:00",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ id: "te-1", ...args.data, startTime: "10:00" }),
    );

    const res = await handler.POST(clockReq({ action: "out" }));
    expect(res.status).toBe(200);
    // Break should have been auto-ended
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.breakEnd).toBeTruthy();
    expect(updateCall.data.breakMinutes).toBeTypeOf("number");
  });
});

/* ══════════════════════════════════════════════════════════════════
   GET /api/time-entries/clock — clock status
   ══════════════════════════════════════════════════════════════════ */

describe("GET /api/time-entries/clock", () => {
  let handler: typeof import("@/app/api/time-entries/clock/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/time-entries/clock/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/time-entries/clock"),
    );
    expect(res.status).toBe(401);
  });

  it("returns noProfile when user has no employeeId", async () => {
    mockSession.user = buildOwner({ employeeId: null });
    const res = await handler.GET(
      new Request("http://localhost/api/time-entries/clock"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.noProfile).toBe(true);
    expect(body.active).toBe(false);
  });

  it("returns active=true when there is an open clock entry", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      breakStart: null,
      breakEnd: null,
    });
    mockTimeEntryFindMany.mockResolvedValue([]);

    const res = await handler.GET(
      new Request("http://localhost/api/time-entries/clock"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.entry).not.toBeNull();
  });

  it("returns onBreak=true when break is active", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te-1",
      breakStart: "12:00",
      breakEnd: null,
    });
    mockTimeEntryFindMany.mockResolvedValue([]);

    const res = await handler.GET(
      new Request("http://localhost/api/time-entries/clock"),
    );
    const body = await res.json();
    expect(body.onBreak).toBe(true);
  });
});
