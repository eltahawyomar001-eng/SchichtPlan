/**
 * @vitest-environment node
 *
 * Tests for the Month-Close API:
 *   GET  /api/month-close — list month-close records
 *   POST /api/month-close — lock / unlock / export
 *
 * Critical for payroll — once a month is locked, time entries
 * cannot be modified.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ── */
const {
  mockSession,
  mockMonthCloseFindMany,
  mockMonthCloseFindFirst,
  mockMonthCloseCreate,
  mockMonthCloseUpdate,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockMonthCloseFindMany: vi.fn(),
  mockMonthCloseFindFirst: vi.fn(),
  mockMonthCloseCreate: vi.fn(),
  mockMonthCloseUpdate: vi.fn(),
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
    monthClose: {
      findMany: mockMonthCloseFindMany,
      findFirst: mockMonthCloseFindFirst,
      create: mockMonthCloseCreate,
      update: mockMonthCloseUpdate,
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

vi.mock("@/lib/subscription", () => ({
  canUseFeature: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/e-signature", () => ({
  createESignature: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildManager, buildEmployee } from "../helpers/factories";

/* ── Helpers ── */
function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/month-close", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ══════════════════════════════════════════════════════════════════
   GET /api/month-close
   ══════════════════════════════════════════════════════════════════ */

describe("GET /api/month-close", () => {
  let handler: typeof import("@/app/api/month-close/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/month-close/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/month-close"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE lacks permission", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    const res = await handler.GET(
      new Request("http://localhost/api/month-close"),
    );
    expect(res.status).toBe(403);
  });

  it("returns month-close records for admins", async () => {
    mockSession.user = buildAdmin();
    mockMonthCloseFindMany.mockResolvedValue([
      { id: "mc-1", year: 2025, month: 1, status: "LOCKED" },
    ]);

    const res = await handler.GET(
      new Request("http://localhost/api/month-close"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("returns 403 when MANAGER lacks permission", async () => {
    mockSession.user = buildManager();
    const res = await handler.GET(
      new Request("http://localhost/api/month-close"),
    );
    expect(res.status).toBe(403);
  });
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/month-close — lock
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/month-close — lock", () => {
  let handler: typeof import("@/app/api/month-close/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/month-close/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "lock" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to lock", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "lock" }),
    );
    expect(res.status).toBe(403);
  });

  it("creates new month-close record on first lock", async () => {
    const user = buildAdmin({ workspaceId: "ws-1" });
    mockSession.user = user;
    mockMonthCloseFindFirst.mockResolvedValue(null); // no existing record
    mockMonthCloseCreate.mockResolvedValue({
      id: "mc-1",
      year: 2025,
      month: 1,
      status: "LOCKED",
      lockedBy: user.id,
    });

    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "lock" }),
    );
    expect(res.status).toBe(200);
    expect(mockMonthCloseCreate).toHaveBeenCalledOnce();
    const createCall = mockMonthCloseCreate.mock.calls[0][0];
    expect(createCall.data.status).toBe("LOCKED");
    expect(createCall.data.lockedBy).toBe(user.id);
  });

  it("updates existing record when locking again", async () => {
    const user = buildAdmin({ workspaceId: "ws-1" });
    mockSession.user = user;
    mockMonthCloseFindFirst.mockResolvedValue({
      id: "mc-1",
      status: "OPEN",
    });
    mockMonthCloseUpdate.mockResolvedValue({
      id: "mc-1",
      status: "LOCKED",
      lockedBy: user.id,
    });

    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "lock" }),
    );
    expect(res.status).toBe(200);
    expect(mockMonthCloseUpdate).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid action", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "invalid" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid month", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    const res = await handler.POST(
      postReq({ year: 2025, month: 13, action: "lock" }),
    );
    expect(res.status).toBe(400);
  });
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/month-close — unlock
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/month-close — unlock", () => {
  let handler: typeof import("@/app/api/month-close/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/month-close/route");
  });

  it("unlocks a locked month", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockMonthCloseFindFirst.mockResolvedValue({
      id: "mc-1",
      status: "LOCKED",
    });
    mockMonthCloseUpdate.mockResolvedValue({
      id: "mc-1",
      status: "OPEN",
      lockedBy: null,
      lockedAt: null,
    });

    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "unlock" }),
    );
    expect(res.status).toBe(200);
    const updateCall = mockMonthCloseUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("OPEN");
    expect(updateCall.data.lockedBy).toBeNull();
  });

  it("returns 404 when unlocking non-existent month", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockMonthCloseFindFirst.mockResolvedValue(null);

    const res = await handler.POST(
      postReq({ year: 2025, month: 6, action: "unlock" }),
    );
    expect(res.status).toBe(404);
  });
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/month-close — export
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/month-close — export", () => {
  let handler: typeof import("@/app/api/month-close/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/month-close/route");
  });

  it("exports a locked month", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockMonthCloseFindFirst.mockResolvedValue({
      id: "mc-1",
      status: "LOCKED",
    });
    mockMonthCloseUpdate.mockResolvedValue({
      id: "mc-1",
      status: "EXPORTED",
    });

    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "export" }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when exporting an open (unlocked) month", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockMonthCloseFindFirst.mockResolvedValue({
      id: "mc-1",
      status: "OPEN",
    });

    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "export" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when exporting non-existent month", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockMonthCloseFindFirst.mockResolvedValue(null);

    const res = await handler.POST(
      postReq({ year: 2025, month: 1, action: "export" }),
    );
    expect(res.status).toBe(400);
  });
});
