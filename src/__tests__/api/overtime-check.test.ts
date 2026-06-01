/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/overtime-check
 *
 * Dual-auth: CRON_SECRET bearer token OR regular session auth (manager+).
 * Iterates all workspaces (cron mode) or the caller's workspace (manual mode).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockWorkspaceFindMany, mockCheckOvertimeAlerts } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockWorkspaceFindMany: vi.fn(),
    mockCheckOvertimeAlerts: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  prisma: { workspace: { findMany: mockWorkspaceFindMany } },
}));
vi.mock("@/lib/automations", () => ({
  checkOvertimeAlerts: mockCheckOvertimeAlerts,
}));
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
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId,
      };
    }),
  };
});
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

const CRON_SECRET = "cron-secret";

const manager: SessionUser = {
  id: "u1",
  email: "mgr@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "Mgr",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const emp: SessionUser = {
  ...manager,
  id: "u2",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

function makeReq(secret?: string) {
  return new Request("http://localhost/api/automations/overtime-check", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/automations/overtime-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockSession.user = null;
    mockCheckOvertimeAlerts.mockResolvedValue({ alerts: [] });
  });

  it("returns 403 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/automations/overtime-check/route");
    const res = await GET(makeReq("bad-secret"));
    expect(res.status).toBe(403);
  });

  it("runs against all workspaces in cron mode", async () => {
    mockWorkspaceFindMany.mockResolvedValue([{ id: "ws1" }, { id: "ws2" }]);
    mockCheckOvertimeAlerts.mockResolvedValue({ alerts: ["emp1 at +2h"] });
    const { GET } = await import("@/app/api/automations/overtime-check/route");
    const res = await GET(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.alerts).toHaveLength(2); // one alert from each workspace
    expect(mockCheckOvertimeAlerts).toHaveBeenCalledTimes(2);
  });

  it("returns 401 when called via session without auth", async () => {
    // No Bearer token → falls through to session auth
    const { GET } = await import("@/app/api/automations/overtime-check/route");
    const res = await GET(makeReq()); // no auth at all
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee calls manually", async () => {
    mockSession.user = emp;
    const { GET } = await import("@/app/api/automations/overtime-check/route");
    const res = await GET(
      new Request("http://localhost/api/automations/overtime-check"),
    );
    expect(res.status).toBe(403);
  });

  it("runs for the caller's workspace in manual (manager) mode", async () => {
    mockSession.user = manager;
    mockCheckOvertimeAlerts.mockResolvedValue({ alerts: [] });
    const { GET } = await import("@/app/api/automations/overtime-check/route");
    const res = await GET(
      new Request("http://localhost/api/automations/overtime-check"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCheckOvertimeAlerts).toHaveBeenCalledWith("ws1");
  });
});
