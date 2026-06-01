/**
 * @vitest-environment node
 *
 * Tests for GET /api/billing/usage
 *
 * Returns metered usage snapshot (employees, locations, storage, PDFs).
 * Available to any authenticated workspace member.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockEnsureUsage,
  mockGetPlan,
  mockLocationCount,
  mockEmployeeCount,
  mockInvitationCount,
  mockTicketStorage,
  mockQueryRaw,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockEnsureUsage: vi.fn(),
  mockGetPlan: vi.fn(),
  mockLocationCount: vi.fn(),
  mockEmployeeCount: vi.fn(),
  mockInvitationCount: vi.fn(),
  mockTicketStorage: vi.fn(),
  mockQueryRaw: vi.fn(),
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
  prisma: {
    location: { count: mockLocationCount },
    employee: { count: mockEmployeeCount },
    invitation: { count: mockInvitationCount },
    $queryRaw: mockQueryRaw,
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
vi.mock("@/lib/subscription-guard", () => ({
  ensureWorkspaceUsage: mockEnsureUsage,
}));
vi.mock("@/lib/subscription", () => ({ getWorkspacePlan: mockGetPlan }));
vi.mock("@/lib/ticket-trash", () => ({
  getTicketStorageBreakdown: mockTicketStorage,
}));
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
  subscriptionStatus: "ACTIVE",
  planId: "pro",
  trialEndsAt: null,
};

const usageSnapshot = {
  userSlotsTotal: 10,
  storageBytesUsed: BigInt(1024 * 1024 * 50),
  storageBytesLimit: BigInt(1024 * 1024 * 500),
  pdfsGeneratedThisMonth: 5,
  pdfsMonthlyLimit: 100,
  ticketsCreatedThisMonth: 3,
  ticketsMonthlyLimit: 50,
  emailsSentThisMonth: 10,
  emailsMonthlyLimit: 500,
  ticketStorageBytesLimit: BigInt(1024 * 1024 * 100),
};

describe("GET /api/billing/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockEnsureUsage.mockResolvedValue(usageSnapshot);
    mockGetPlan.mockResolvedValue({ limits: { maxLocations: 5 } });
    mockLocationCount.mockResolvedValue(2);
    mockEmployeeCount.mockResolvedValue(8);
    mockInvitationCount.mockResolvedValue(1);
    mockTicketStorage.mockResolvedValue({
      activeTickets: 5,
      trashTickets: 2,
      activeBytes: 1024,
      trashBytes: 512,
      totalBytes: 1536,
    });
    mockQueryRaw.mockResolvedValue([{ total_bytes: BigInt(1024 * 1024 * 50) }]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/billing/usage/route");
    const res = await GET(new Request("http://localhost/api/billing/usage"));
    expect(res.status).toBe(401);
  });

  it("returns usage snapshot for authenticated user", async () => {
    mockSession.user = user;
    const { GET } = await import("@/app/api/billing/usage/route");
    const res = await GET(new Request("http://localhost/api/billing/usage"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("employees");
    expect(body).toHaveProperty("locations");
    expect(body).toHaveProperty("storageMb");
    expect(body).toHaveProperty("pdfsThisMonth");
    expect(body.employees.used).toBe(8);
    expect(body.employees.limit).toBe(10);
  });

  it("returns null limit when unlimited (>= 999999)", async () => {
    mockSession.user = user;
    mockEnsureUsage.mockResolvedValue({
      ...usageSnapshot,
      userSlotsTotal: 999999,
    });
    const { GET } = await import("@/app/api/billing/usage/route");
    const res = await GET(new Request("http://localhost/api/billing/usage"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employees.limit).toBeNull();
  });
});
