/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/sos-escalation
 *
 * Cron job (every 5 min):
 * 1. Expires overdue OPEN SOS requests.
 * 2. Escalates to the next tier when nextEscalationAt has passed.
 * Returns { expired, escalated }.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSosUpdateMany,
  mockSosNotifUpdateMany,
  mockSosRequestFindMany,
  mockSosRequestFindFirst,
  mockSosRequestUpdate,
  mockSosNotifFindMany,
  mockRankEmployees,
  mockNotifyTier,
  mockGetTierSlice,
  mockEmitSos,
} = vi.hoisted(() => ({
  mockSosUpdateMany: vi.fn(),
  mockSosNotifUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockSosRequestFindMany: vi.fn(),
  mockSosRequestFindFirst: vi.fn(),
  mockSosRequestUpdate: vi.fn().mockResolvedValue({}),
  mockSosNotifFindMany: vi.fn().mockResolvedValue([]),
  mockRankEmployees: vi.fn().mockResolvedValue([]),
  mockNotifyTier: vi.fn().mockResolvedValue([]),
  mockGetTierSlice: vi.fn().mockReturnValue([]),
  mockEmitSos: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    sosRequest: {
      updateMany: mockSosUpdateMany,
      findMany: mockSosRequestFindMany,
      findFirst: mockSosRequestFindFirst,
      update: mockSosRequestUpdate,
    },
    sosNotification: {
      updateMany: mockSosNotifUpdateMany,
      findMany: mockSosNotifFindMany,
    },
  },
}));
vi.mock("@/lib/sos-ranking", () => ({
  rankEmployeesForSos: mockRankEmployees,
  notifyEmployeeTier: mockNotifyTier,
  getTierSlice: mockGetTierSlice,
}));
vi.mock("@/lib/sos-events", () => ({ emitSosEvent: mockEmitSos }));
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

const CRON = "sos-cron";

function makeReq(secret?: string) {
  return new Request("http://localhost/api/automations/sos-escalation", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/automations/sos-escalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON);
    mockSosUpdateMany.mockResolvedValue({ count: 0 });
    mockSosRequestFindMany.mockResolvedValue([]);
  });

  it("returns 401 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/automations/sos-escalation/route");
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when no auth provided", async () => {
    const { GET } = await import("@/app/api/automations/sos-escalation/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 200 with zero counts when nothing to process", async () => {
    mockSosUpdateMany.mockResolvedValue({ count: 0 });
    mockSosRequestFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/automations/sos-escalation/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(0);
    expect(body.escalated).toBe(0);
  });

  it("expires overdue open SOS requests", async () => {
    mockSosUpdateMany.mockResolvedValue({ count: 3 });
    mockSosRequestFindMany
      .mockResolvedValueOnce([
        { id: "sos1", shiftId: "s1" },
        { id: "sos2", shiftId: "s2" },
        { id: "sos3", shiftId: "s3" },
      ]) // expired requests
      .mockResolvedValueOnce([]); // ready-to-escalate
    const { GET } = await import("@/app/api/automations/sos-escalation/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(3);
    expect(mockSosUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "EXPIRED" } }),
    );
  });
});
