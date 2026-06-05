/**
 * @vitest-environment node
 *
 * Tests for POST /api/tickets/[id]/restore
 *
 * Restores a soft-deleted (trashed) ticket back to active.
 * Requires tickets:delete permission (same as DELETE — reverses destructive action).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockTicketFindFirst,
  mockRestoreTicket,
  mockLogEvent,
  mockAddon,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockTicketFindFirst: vi.fn(),
  mockRestoreTicket: vi.fn().mockResolvedValue(undefined),
  mockLogEvent: vi.fn().mockResolvedValue(undefined),
  mockAddon: vi.fn().mockResolvedValue(null),
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
  prisma: { ticket: { findFirst: mockTicketFindFirst } },
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
vi.mock("@/lib/ticket-trash", () => ({ restoreTicket: mockRestoreTicket }));
vi.mock("@/lib/ticket-events", () => ({ logTicketRestored: mockLogEvent }));
vi.mock("@/lib/ticketing-addon", () => ({ requireTicketingAddon: mockAddon }));
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

// tickets:delete is OWNER/ADMIN only
const admin: SessionUser = {
  id: "u1",
  email: "admin@test.com",
  workspaceId: "ws1",
  role: "ADMIN",
  employeeId: null,
  name: "Admin",
};
const manager: SessionUser = { ...admin, id: "u2", role: "MANAGER" };

const makeCtx = (id = "t1") => ({ params: Promise.resolve({ id }) });
const postReq = () =>
  new Request("http://localhost/api/tickets/t1/restore", { method: "POST" });

const trashedTicket = {
  id: "t1",
  deletedAt: new Date(),
  ticketNumber: "T-001",
};
const activeTicket = { id: "t2", deletedAt: null, ticketNumber: "T-002" };

describe("POST /api/tickets/[id]/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockAddon.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/tickets/[id]/restore/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls (tickets:delete is OWNER/ADMIN)", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/tickets/[id]/restore/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when ticket not found", async () => {
    mockSession.user = admin;
    mockTicketFindFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/tickets/[id]/restore/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns alreadyActive:true if ticket is not in trash", async () => {
    mockSession.user = admin;
    mockTicketFindFirst.mockResolvedValue(activeTicket);
    const { POST } = await import("@/app/api/tickets/[id]/restore/route");
    const res = await POST(postReq(), makeCtx("t2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyActive).toBe(true);
    expect(mockRestoreTicket).not.toHaveBeenCalled();
  });

  it("restores a trashed ticket and returns restored:true", async () => {
    mockSession.user = admin;
    mockTicketFindFirst.mockResolvedValue(trashedTicket);
    const { POST } = await import("@/app/api/tickets/[id]/restore/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.restored).toBe(true);
    expect(mockRestoreTicket).toHaveBeenCalledWith({
      ticketId: "t1",
      workspaceId: "ws1",
    });
    expect(mockLogEvent).toHaveBeenCalled();
  });
});
