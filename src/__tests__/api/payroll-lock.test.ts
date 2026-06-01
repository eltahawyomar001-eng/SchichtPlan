/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/payroll-lock
 *
 * Locks reviewed time entries for a completed month.
 * Dual-auth: CRON_SECRET bearer (all workspaces) or session (manager's workspace).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockWorkspaceFindMany, mockLockMonth } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockWorkspaceFindMany: vi.fn(),
    mockLockMonth: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: { workspace: { findMany: mockWorkspaceFindMany } },
}));
vi.mock("@/lib/automations", () => ({ lockMonthTimeEntries: mockLockMonth }));
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
    parseJsonBody: vi.fn(async (req: Request) => {
      try {
        const data = await req.json();
        return { ok: true, data };
      } catch {
        return { ok: true, data: {} };
      }
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

const CRON = "payroll-cron";
// Manual payroll-lock is OWNER/ADMIN only — MANAGER gets 403
const admin: SessionUser = {
  id: "u1",
  email: "admin@test.com",
  workspaceId: "ws1",
  role: "ADMIN",
  employeeId: null,
  name: "Admin",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};
const manager: SessionUser = { ...admin, id: "u3", role: "MANAGER" };
const emp: SessionUser = {
  ...admin,
  id: "u2",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

function makeReq(secret?: string, body?: object) {
  return new Request("http://localhost/api/automations/payroll-lock", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/automations/payroll-lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON);
    mockSession.user = null;
    mockLockMonth.mockResolvedValue({ locked: 0, month: "2026-05" });
  });

  it("returns 403 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/automations/payroll-lock/route");
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(403);
  });

  it("runs across all workspaces in cron mode", async () => {
    mockWorkspaceFindMany.mockResolvedValue([{ id: "ws1" }, { id: "ws2" }]);
    mockLockMonth.mockResolvedValue({ locked: 5, month: "2026-05" });
    const { GET } = await import("@/app/api/automations/payroll-lock/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.totalLocked).toBe(10); // 5 per workspace × 2
    expect(mockLockMonth).toHaveBeenCalledTimes(2);
  });

  it("returns 401 when no auth provided", async () => {
    const { GET } = await import("@/app/api/automations/payroll-lock/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls manually (OWNER/ADMIN only)", async () => {
    mockSession.user = manager;
    const { GET } = await import("@/app/api/automations/payroll-lock/route");
    const res = await GET(
      new Request("http://localhost/api/automations/payroll-lock"),
    );
    expect(res.status).toBe(403);
  });

  it("locks entries for caller's workspace when called by ADMIN", async () => {
    mockSession.user = admin;
    mockLockMonth.mockResolvedValue({ locked: 12, month: "2026-04" });
    const { GET } = await import("@/app/api/automations/payroll-lock/route");
    const res = await GET(
      new Request("http://localhost/api/automations/payroll-lock"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.locked).toBe(12);
  });
});
