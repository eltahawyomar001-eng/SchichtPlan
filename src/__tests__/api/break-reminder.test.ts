/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/break-reminder
 *
 * Cron job (every 15 min) that checks ArbZG §4 compliance:
 *  - Sends push notification when an employee has been working 6+ hours without a break
 *  - Auto-clocks-out entries at the 10h limit (ArbZG §3)
 *
 * Tests cover: bad cron secret, no qualifying entries, break reminder sent,
 * and auto-clockout at 10h limit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockUpdate, mockSendPush } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockSendPush: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    timeEntry: { findMany: mockFindMany, update: mockUpdate },
    user: { findFirst: vi.fn().mockResolvedValue({ id: "u1" }) },
    notification: {
      findFirst: vi.fn().mockResolvedValue(null), // not already notified
      create: vi.fn().mockResolvedValue({ id: "n1" }),
    },
  },
}));
vi.mock("@/lib/notifications/push", () => ({
  sendPushNotification: mockSendPush,
}));
vi.mock("@/lib/automations", () => ({
  ensureLegalBreak: vi.fn((gross: number) => Math.max(0, gross > 360 ? 30 : 0)),
  ARBZG_MAX_DAILY_MINUTES: 600,
}));
vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
  cronMonitor: vi.fn(() => ({
    start: vi.fn(),
    finish: vi.fn(),
    error: vi.fn(),
  })),
}));
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
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

const CRON_SECRET = "cron-secret-xyz";

function makeReq(secret?: string) {
  return new Request("http://localhost/api/automations/break-reminder", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/automations/break-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 403 when cron secret is missing", async () => {
    const { GET } = await import("@/app/api/automations/break-reminder/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/automations/break-reminder/route");
    const res = await GET(makeReq("wrong-secret"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with zero reminded when no entries qualify", async () => {
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/automations/break-reminder/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sends break reminder for employee working 6h without break", async () => {
    const sixHoursAgo = new Date(Date.now() - 6.5 * 3600000);
    const entry = {
      id: "te1",
      clockInAt: sixHoursAgo,
      clockOutAt: null,
      breakStart: null,
      breakEnd: null,
      breakMinutes: 0,
      employeeId: "emp1",
      workspaceId: "ws1",
      employee: {
        id: "emp1",
        firstName: "A",
        lastName: "B",
        email: "a@test.com",
      },
    };
    // First findMany = break reminder query, second = excessive (10h+) query
    mockFindMany
      .mockResolvedValueOnce([entry]) // 6h+ entries → trigger reminder
      .mockResolvedValueOnce([]); // no 10h+ entries
    const { GET } = await import("@/app/api/automations/break-reminder/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(mockSendPush).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
    const body = await res.json();
    expect(body.notified).toBe(1);
  });

  it("auto-clocks out an entry at the 10h limit", async () => {
    const tenHoursAgo = new Date(Date.now() - 10.5 * 3600000);
    const entry = {
      id: "te2",
      clockInAt: tenHoursAgo,
      clockOutAt: null,
      breakStart: null,
      breakEnd: null,
      breakMinutes: 0,
      employeeId: "emp2",
      workspaceId: "ws1",
      employee: {
        id: "emp2",
        firstName: "B",
        lastName: "C",
        email: "b@test.com",
      },
    };
    // First findMany = break reminder query (returns this entry too — it's 10h+), second = excessive
    mockFindMany
      .mockResolvedValueOnce([]) // skip reminder loop for simplicity
      .mockResolvedValueOnce([entry]); // 10h+ → force-stop
    const { GET } = await import("@/app/api/automations/break-reminder/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
    const body = await res.json();
    expect(body.forceStopped).toBe(1);
  });
});
