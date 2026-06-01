/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/auto-clockout
 *
 * Cron job that forcibly clocks out live-clock entries exceeding the
 * ArbZG 10-hour daily limit.  Runs every 10 min via Vercel Cron.
 * Tests cover: bad cron secret, concurrent-run lock, no-op when no
 * entries qualify, and successful close of a stale entry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockUpdate, mockCacheGet, mockCacheSet } = vi.hoisted(
  () => ({
    mockFindMany: vi.fn(),
    mockUpdate: vi.fn(),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn().mockResolvedValue(undefined),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    timeEntry: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}));
vi.mock("@/lib/cache", () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
  },
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
vi.mock("@/lib/automations", () => ({
  ARBZG_MAX_DAILY_MINUTES: 600,
  capWorkTimeAtLimit: vi.fn((mins: number) => Math.min(mins, 600)),
  getTodayWorkedMinutes: vi.fn().mockResolvedValue(0),
}));

const CRON_SECRET = "test-secret";

function makeRequest(secret?: string) {
  return new Request("http://localhost/api/automations/auto-clockout", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/automations/auto-clockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockCacheGet.mockResolvedValue(null); // no lock by default
  });

  it("returns 401 when cron secret is missing", async () => {
    const { GET } = await import("@/app/api/automations/auto-clockout/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/automations/auto-clockout/route");
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("skips when concurrent run lock is active", async () => {
    mockCacheGet.mockResolvedValue("1"); // lock exists
    const { GET } = await import("@/app/api/automations/auto-clockout/route");
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("does nothing when no live-clock entries are running", async () => {
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/automations/auto-clockout/route");
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips entries that have not exceeded the 10h limit", async () => {
    const recentClockIn = new Date(Date.now() - 2 * 3600000); // 2 hours ago
    mockFindMany.mockResolvedValue([
      {
        id: "te1",
        clockInAt: recentClockIn,
        clockOutAt: null,
        employeeId: "emp1",
        workspaceId: "ws1",
        date: new Date(),
        employee: { id: "emp1", firstName: "A", lastName: "B" },
      },
    ]);
    const { GET } = await import("@/app/api/automations/auto-clockout/route");
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.closedCount).toBe(0);
  });

  it("closes an entry that has exceeded 10h (600 min)", async () => {
    const oldClockIn = new Date(Date.now() - 11 * 3600000); // 11 hours ago
    mockFindMany.mockResolvedValue([
      {
        id: "te1",
        clockInAt: oldClockIn,
        clockOutAt: null,
        employeeId: "emp1",
        workspaceId: "ws1",
        date: new Date(),
        employee: { id: "emp1", firstName: "A", lastName: "B" },
      },
    ]);
    mockUpdate.mockResolvedValue({});
    const { GET } = await import("@/app/api/automations/auto-clockout/route");
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.closedCount).toBe(1);
  });
});
