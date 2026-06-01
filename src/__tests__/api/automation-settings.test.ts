/**
 * @vitest-environment node
 *
 * Tests for GET / PUT /api/automations/settings
 *
 * OWNER/ADMIN only. Returns merged DB + default automation toggles.
 * PUT upserts individual toggles and returns the full merged state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockSettingsFindMany, mockSettingsUpsert } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockSettingsFindMany: vi.fn(),
    mockSettingsUpsert: vi.fn().mockResolvedValue({}),
  }),
);

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    automationSetting: {
      findMany: mockSettingsFindMany,
      upsert: mockSettingsUpsert,
    },
  },
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
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
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
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };
const emp: SessionUser = {
  ...admin,
  id: "u3",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

describe("GET /api/automations/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockSettingsFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/automations/settings/route");
    const res = await GET(
      new Request("http://localhost/api/automations/settings"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls", async () => {
    mockSession.user = manager;
    const { GET } = await import("@/app/api/automations/settings/route");
    const res = await GET(
      new Request("http://localhost/api/automations/settings"),
    );
    expect(res.status).toBe(403);
  });

  it("returns merged default settings when DB has no overrides", async () => {
    mockSession.user = admin;
    mockSettingsFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/automations/settings/route");
    const res = await GET(
      new Request("http://localhost/api/automations/settings"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toHaveProperty("shiftConflictDetection", true);
    expect(body.settings).toHaveProperty("notifications", true);
  });

  it("overrides defaults with DB values", async () => {
    mockSession.user = admin;
    mockSettingsFindMany.mockResolvedValue([
      { key: "notifications", enabled: false },
    ]);
    const { GET } = await import("@/app/api/automations/settings/route");
    const res = await GET(
      new Request("http://localhost/api/automations/settings"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.notifications).toBe(false);
  });
});

describe("PUT /api/automations/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockSettingsFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { PUT } = await import("@/app/api/automations/settings/route");
    const res = await PUT(
      new Request("http://localhost/api/automations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { notifications: false } }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when employee calls", async () => {
    mockSession.user = emp;
    const { PUT } = await import("@/app/api/automations/settings/route");
    const res = await PUT(
      new Request("http://localhost/api/automations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { notifications: false } }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("upserts and returns merged settings", async () => {
    mockSession.user = admin;
    mockSettingsUpsert.mockResolvedValue({});
    mockSettingsFindMany.mockResolvedValue([
      { key: "notifications", enabled: false },
    ]);
    const { PUT } = await import("@/app/api/automations/settings/route");
    const res = await PUT(
      new Request("http://localhost/api/automations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { notifications: false } }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.notifications).toBe(false);
    expect(mockSettingsUpsert).toHaveBeenCalled();
  });
});
