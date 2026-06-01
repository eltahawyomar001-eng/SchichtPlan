/**
 * @vitest-environment node
 *
 * Tests for GET /api/account/export
 *
 * GDPR Art. 20 — returns the current user's personal data dump.
 * Any authenticated user can request their own export.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockUserFindUnique } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUserFindUnique: vi.fn(),
}));

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
  prisma: { user: { findUnique: mockUserFindUnique } },
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

const user: SessionUser = {
  id: "u1",
  email: "user@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "emp1",
  name: "User",
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

const dbUser = {
  id: "u1",
  name: "User",
  email: "user@test.com",
  phone: null,
  preferredLocale: "de",
  role: "EMPLOYEE",
  consentGivenAt: null,
  tosVersion: "2026-01-01",
  tosAcceptedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  notificationPreferences: [],
  employee: {
    id: "emp1",
    firstName: "User",
    lastName: "Test",
    email: "user@test.com",
    phone: null,
    position: null,
    hourlyRate: null,
    weeklyHours: 40,
    contractType: "VOLLZEIT",
    createdAt: new Date(),
    timeEntries: [],
    notifications: [],
  },
};

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET(new Request("http://localhost/api/account/export"));
    expect(res.status).toBe(401);
  });

  it("returns user's data when authenticated", async () => {
    mockSession.user = user;
    mockUserFindUnique.mockResolvedValue(dbUser);
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET(new Request("http://localhost/api/account/export"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exportedAt).toBeDefined();
    expect(body.data).toBeDefined();
    expect(body.data.email).toBe("user@test.com");
  });

  it("returns null employee section if user has no linked employee", async () => {
    mockSession.user = user;
    mockUserFindUnique.mockResolvedValue({ ...dbUser, employee: null });
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET(new Request("http://localhost/api/account/export"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.employee).toBeNull();
  });

  it("queries only the requesting user's own data", async () => {
    mockSession.user = user;
    mockUserFindUnique.mockResolvedValue(dbUser);
    const { GET } = await import("@/app/api/account/export/route");
    await GET(new Request("http://localhost/api/account/export"));
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
  });
});
