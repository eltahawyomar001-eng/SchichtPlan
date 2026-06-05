/**
 * @vitest-environment node
 *
 * Tests for POST and GET /api/account/accept-tos
 *
 * POST: stores the user's ToS acceptance (idempotent).
 * GET:  returns whether the current version has been accepted.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockUserUpdate, mockUserFindUnique, CURRENT_TOS_VERSION } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockUserUpdate: vi.fn(),
    mockUserFindUnique: vi.fn(),
    CURRENT_TOS_VERSION: "2026-01-01",
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
  prisma: { user: { update: mockUserUpdate, findUnique: mockUserFindUnique } },
}));
vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async (_opts?: { requireWorkspace?: boolean }) => {
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
vi.mock("@/lib/legal-version", () => ({ CURRENT_TOS_VERSION: "2026-01-01" }));
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
  role: "MANAGER",
  employeeId: null,
  name: "User",
};

describe("POST /api/account/accept-tos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/account/accept-tos/route");
    const res = await POST(
      new Request("http://localhost/api/account/accept-tos", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("records acceptance and returns current version", async () => {
    mockSession.user = user;
    mockUserUpdate.mockResolvedValue({
      id: "u1",
      tosVersion: CURRENT_TOS_VERSION,
    });
    const { POST } = await import("@/app/api/account/accept-tos/route");
    const res = await POST(
      new Request("http://localhost/api/account/accept-tos", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.version).toBe(CURRENT_TOS_VERSION);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
  });
});

describe("GET /api/account/accept-tos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/account/accept-tos/route");
    const res = await GET(
      new Request("http://localhost/api/account/accept-tos"),
    );
    expect(res.status).toBe(401);
  });

  it("returns accepted:true when user has accepted current version", async () => {
    mockSession.user = user;
    mockUserFindUnique.mockResolvedValue({
      tosVersion: CURRENT_TOS_VERSION,
      tosAcceptedAt: new Date(),
    });
    const { GET } = await import("@/app/api/account/accept-tos/route");
    const res = await GET(
      new Request("http://localhost/api/account/accept-tos"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.currentVersion).toBe(CURRENT_TOS_VERSION);
  });

  it("returns accepted:false when user has an older version", async () => {
    mockSession.user = user;
    mockUserFindUnique.mockResolvedValue({
      tosVersion: "2025-01-01",
      tosAcceptedAt: new Date("2025-01-01"),
    });
    const { GET } = await import("@/app/api/account/accept-tos/route");
    const res = await GET(
      new Request("http://localhost/api/account/accept-tos"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.acceptedVersion).toBe("2025-01-01");
  });

  it("returns accepted:false when user has never accepted", async () => {
    mockSession.user = user;
    mockUserFindUnique.mockResolvedValue({
      tosVersion: null,
      tosAcceptedAt: null,
    });
    const { GET } = await import("@/app/api/account/accept-tos/route");
    const res = await GET(
      new Request("http://localhost/api/account/accept-tos"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(false);
  });
});
