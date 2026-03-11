/**
 * @vitest-environment node
 *
 * Tests for Invitations API:
 *   GET  /api/invitations — list invitations
 *   POST /api/invitations — create invitation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockInvitationFindMany,
  mockInvitationCount,
  mockInvitationCreate,
  mockSubscriptionFindUnique,
  mockEmployeeCount,
  mockUsageFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockInvitationFindMany: vi.fn(),
  mockInvitationCount: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockEmployeeCount: vi.fn(),
  mockUsageFindUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    invitation: {
      findMany: mockInvitationFindMany,
      count: mockInvitationCount,
      create: mockInvitationCreate,
    },
    subscription: { findUnique: mockSubscriptionFindUnique },
    employee: { count: mockEmployeeCount },
    workspaceUsage: {
      findUnique: mockUsageFindUnique,
      create: vi
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "usage-1", ...args.data }),
        ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/subscription-guard", () => ({
  requireUserSlot: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn().mockReturnValue({ take: 50, skip: 0 }),
  paginatedResponse: vi.fn(
    async (items: unknown[], total: number, take: number, skip: number) => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ data: items, total, take, skip });
    },
  ),
}));

import {
  buildOwner,
  buildAdmin,
  buildManager,
  buildEmployee,
} from "../helpers/factories";

describe("GET /api/invitations", () => {
  let handler: typeof import("@/app/api/invitations/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/invitations/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to list", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 when MANAGER tries to list", async () => {
    mockSession.user = buildManager();
    const res = await handler.GET();
    expect(res.status).toBe(403);
  });

  it("returns invitations for OWNER", async () => {
    mockSession.user = buildOwner();
    mockInvitationFindMany.mockResolvedValue([
      { id: "inv-1", email: "new@test.com", status: "PENDING" },
    ]);
    mockInvitationCount.mockResolvedValue(1);

    const res = await handler.GET();
    expect(res.status).toBe(200);
  });

  it("returns invitations for ADMIN", async () => {
    mockSession.user = buildAdmin();
    mockInvitationFindMany.mockResolvedValue([]);
    mockInvitationCount.mockResolvedValue(0);

    const res = await handler.GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/invitations", () => {
  let handler: typeof import("@/app/api/invitations/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/invitations/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "new@test.com",
          role: "EMPLOYEE",
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to invite", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "new@test.com",
          role: "EMPLOYEE",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
