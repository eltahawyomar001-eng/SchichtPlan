/**
 * @vitest-environment node
 *
 * Tests for GET /api/tickets/[id]/events
 *
 * Employees can only see events on tickets they created or are assigned to.
 * Managers see all ticket events. Requires tickets:read permission.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockTicketFindFirst, mockEventFindMany, mockAddon } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockTicketFindFirst: vi.fn(),
    mockEventFindMany: vi.fn(),
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
  prisma: {
    ticket: { findFirst: mockTicketFindFirst },
    ticketEvent: { findMany: mockEventFindMany },
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
const empUser: SessionUser = {
  ...manager,
  id: "u2",
  email: "emp@test.com",
  role: "EMPLOYEE",
  employeeId: "emp1",
};

const makeCtx = (id = "t1") => ({ params: Promise.resolve({ id }) });
const ticket = { id: "t1", createdById: "u1", assignedToId: null };
const empTicket = { id: "t2", createdById: "u2", assignedToId: null }; // created by emp
const otherTicket = { id: "t3", createdById: "u3", assignedToId: null }; // created by someone else
const events = [
  { id: "ev1", ticketId: "t1", type: "CREATED", createdAt: new Date() },
];

describe("GET /api/tickets/[id]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockAddon.mockResolvedValue(null);
    mockEventFindMany.mockResolvedValue(events);
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/tickets/[id]/events/route");
    const res = await GET(
      new Request("http://localhost/api/tickets/t1/events"),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockSession.user = manager;
    mockTicketFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tickets/[id]/events/route");
    const res = await GET(
      new Request("http://localhost/api/tickets/t1/events"),
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns events for manager", async () => {
    mockSession.user = manager;
    mockTicketFindFirst.mockResolvedValue(ticket);
    const { GET } = await import("@/app/api/tickets/[id]/events/route");
    const res = await GET(
      new Request("http://localhost/api/tickets/t1/events"),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("allows employee to see events on their own ticket", async () => {
    mockSession.user = empUser;
    mockTicketFindFirst.mockResolvedValue(empTicket); // createdById: u2 matches
    const { GET } = await import("@/app/api/tickets/[id]/events/route");
    const res = await GET(
      new Request("http://localhost/api/tickets/t2/events"),
      makeCtx("t2"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when employee accesses another user's ticket", async () => {
    mockSession.user = empUser;
    mockTicketFindFirst.mockResolvedValue(otherTicket); // not created by or assigned to emp
    const { GET } = await import("@/app/api/tickets/[id]/events/route");
    const res = await GET(
      new Request("http://localhost/api/tickets/t3/events"),
      makeCtx("t3"),
    );
    expect(res.status).toBe(403);
  });
});
