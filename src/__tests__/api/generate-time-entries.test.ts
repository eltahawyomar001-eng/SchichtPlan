/**
 * @vitest-environment node
 *
 * Tests for GET /api/automations/generate-time-entries
 *
 * Dual-auth: CRON_SECRET bearer (all workspaces) or session (manager+).
 * Generates draft time entries from past shifts that have none yet.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockWorkspaceFindMany, mockGenerateEntries } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockWorkspaceFindMany: vi.fn(),
    mockGenerateEntries: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: { workspace: { findMany: mockWorkspaceFindMany } },
}));
vi.mock("@/lib/automations", () => ({
  generateTimeEntriesFromShifts: mockGenerateEntries,
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

const CRON = "gen-cron";
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
  return new Request("http://localhost/api/automations/generate-time-entries", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/automations/generate-time-entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON);
    mockSession.user = null;
    mockGenerateEntries.mockResolvedValue({ created: 0 });
  });

  it("returns 403 when cron secret is wrong", async () => {
    const { GET } =
      await import("@/app/api/automations/generate-time-entries/route");
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(403);
  });

  it("processes all workspaces in cron mode", async () => {
    mockWorkspaceFindMany.mockResolvedValue([{ id: "ws1" }, { id: "ws2" }]);
    mockGenerateEntries.mockResolvedValue({ created: 3 });
    const { GET } =
      await import("@/app/api/automations/generate-time-entries/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.totalCreated).toBe(6); // 3 per workspace × 2
    expect(body.workspacesProcessed).toBe(2);
  });

  it("returns 401 when no auth", async () => {
    const { GET } =
      await import("@/app/api/automations/generate-time-entries/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee calls manually", async () => {
    mockSession.user = emp;
    const { GET } =
      await import("@/app/api/automations/generate-time-entries/route");
    const res = await GET(
      new Request("http://localhost/api/automations/generate-time-entries"),
    );
    expect(res.status).toBe(403);
  });

  it("generates entries for caller's workspace in manual mode", async () => {
    mockSession.user = manager;
    mockGenerateEntries.mockResolvedValue({ created: 8 });
    const { GET } =
      await import("@/app/api/automations/generate-time-entries/route");
    const res = await GET(
      new Request("http://localhost/api/automations/generate-time-entries"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockGenerateEntries).toHaveBeenCalledWith("ws1");
  });
});
