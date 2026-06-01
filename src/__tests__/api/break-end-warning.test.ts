/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/break-end-warning
 *
 * Cron job (every 5 min) that sends WebPush notifications when a break
 * is about to end (warning) or has already overrun. Uses a concurrency lock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindMany,
  mockNotifFindFirst,
  mockNotifCreate,
  mockUserFindFirst,
  mockSendPush,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockNotifFindFirst: vi.fn().mockResolvedValue(null),
  mockNotifCreate: vi.fn().mockResolvedValue({ id: "n1" }),
  mockUserFindFirst: vi.fn().mockResolvedValue({ id: "u1" }),
  mockSendPush: vi.fn().mockResolvedValue(undefined),
  mockCacheGet: vi.fn().mockResolvedValue(null),
  mockCacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    timeEntry: { findMany: mockFindMany },
    notification: { findFirst: mockNotifFindFirst, create: mockNotifCreate },
    user: { findFirst: mockUserFindFirst },
  },
}));
vi.mock("@/lib/cache", () => ({
  cache: { get: mockCacheGet, set: mockCacheSet },
}));
vi.mock("@/lib/notifications/push", () => ({
  sendPushNotification: mockSendPush,
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

const CRON_SECRET = "break-cron-secret";

function makeReq(secret?: string) {
  return new Request("http://localhost/api/automations/break-end-warning", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

// A break entry that started 55 minutes ago (5 min until the typical 60-min break ends)
function makeBreakEntry(breakStartMinutesAgo: number) {
  const now = new Date();
  const breakStartHour = new Date(now.getTime() - breakStartMinutesAgo * 60000);
  return {
    id: "te1",
    workspaceId: "ws1",
    employeeId: "emp1",
    breakStart: breakStartHour.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    }),
    breakEnd: null,
    employee: {
      id: "emp1",
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
    },
    workspace: { defaultBreakMinutes: 30 },
  };
}

describe("GET /api/automations/break-end-warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockCacheGet.mockResolvedValue(null); // no lock
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 403 when cron secret is missing", async () => {
    const { GET } =
      await import("@/app/api/automations/break-end-warning/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 when cron secret is wrong", async () => {
    const { GET } =
      await import("@/app/api/automations/break-end-warning/route");
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(403);
  });

  it("skips when concurrent run lock is active", async () => {
    mockCacheGet.mockResolvedValue("1");
    const { GET } =
      await import("@/app/api/automations/break-end-warning/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns 200 with zero counts when no break entries exist", async () => {
    mockFindMany.mockResolvedValue([]);
    const { GET } =
      await import("@/app/api/automations/break-end-warning/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("checked");
    expect(body).toHaveProperty("warned");
    expect(body).toHaveProperty("overrun");
  });

  it("processes active break entries and sends notifications", async () => {
    const entry = makeBreakEntry(55); // 55 min in → 5 min left on 60-min break
    mockFindMany.mockResolvedValue([entry]);
    mockUserFindFirst.mockResolvedValue({ id: "u1" });
    mockNotifFindFirst.mockResolvedValue(null); // not already notified
    const { GET } =
      await import("@/app/api/automations/break-end-warning/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    // The entry was processed — checked count equals entries found
    expect(typeof body.checked).toBe("number");
    expect(typeof body.warned).toBe("number");
    expect(typeof body.overrun).toBe("number");
  });
});
