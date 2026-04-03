/**
 * @vitest-environment node
 *
 * Unit tests for the Tickets API route handlers.
 * Mock the session & Prisma layer to test route logic
 * (auth, permissions, validation, response shapes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Shared mock state ──────────────────────────────────────── */
const {
  mockSession,
  mockTicketFindMany,
  mockTicketCount,
  mockTicketFindFirst,
  mockTicketCreate,
  mockTicketUpdate,
  mockTicketGroupBy,
  mockTicketCommentCreate,
  mockUserFindFirst,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockTicketFindMany: vi.fn(),
  mockTicketCount: vi.fn(),
  mockTicketFindFirst: vi.fn(),
  mockTicketCreate: vi.fn(),
  mockTicketUpdate: vi.fn(),
  mockTicketGroupBy: vi.fn(),
  mockTicketCommentCreate: vi.fn(),
  mockUserFindFirst: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    ticket: {
      findMany: mockTicketFindMany,
      count: mockTicketCount,
      findFirst: mockTicketFindFirst,
      create: mockTicketCreate,
      update: mockTicketUpdate,
      groupBy: mockTicketGroupBy,
    },
    ticketComment: {
      create: mockTicketCommentCreate,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
  };
  return { prisma: mockPrisma };
});

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
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

/* ═══════════════════════════════════════════════════════════════
   GET /api/tickets
   ═══════════════════════════════════════════════════════════════ */

describe("GET /api/tickets", () => {
  let handler: typeof import("@/app/api/tickets/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/tickets/route");
    mockTicketFindMany.mockResolvedValue([]);
    mockTicketCount.mockResolvedValue(0);
    mockSession.user = null;
  });

  it("returns 401 when not authenticated", async () => {
    const req = new Request("http://localhost:3000/api/tickets");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with tickets for OWNER", async () => {
    mockSession.user = buildOwner();
    mockTicketFindMany.mockResolvedValue([
      {
        id: "t1",
        ticketNumber: "TK-2025-0001",
        subject: "Test ticket",
        status: "OFFEN",
        createdBy: { id: "u1", name: "User", email: "u@test.com" },
        assignedTo: null,
        _count: { comments: 0 },
      },
    ]);
    mockTicketCount.mockResolvedValue(1);

    const req = new Request("http://localhost:3000/api/tickets");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].ticketNumber).toBe("TK-2025-0001");
  });

  it("scopes EMPLOYEE to their own tickets", async () => {
    const emp = buildEmployee({ id: "emp-user-1" });
    mockSession.user = emp;
    mockTicketFindMany.mockResolvedValue([]);
    mockTicketCount.mockResolvedValue(0);

    const req = new Request("http://localhost:3000/api/tickets");
    await handler.GET(req);

    // The where clause should include createdById
    const whereArg = mockTicketFindMany.mock.calls[0][0].where;
    expect(whereArg.createdById).toBe("emp-user-1");
  });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/tickets
   ═══════════════════════════════════════════════════════════════ */

describe("POST /api/tickets", () => {
  let handler: typeof import("@/app/api/tickets/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/tickets/route");
    mockTicketFindFirst.mockResolvedValue(null);
    mockSession.user = null;
  });

  it("returns 401 when not authenticated", async () => {
    const req = new Request("http://localhost:3000/api/tickets", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input", async () => {
    mockSession.user = buildOwner();
    const req = new Request("http://localhost:3000/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "ab" }), // too short, missing fields
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(400);
  });

  it("creates ticket with valid input", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockTicketFindFirst.mockResolvedValue(null); // no previous tickets
    mockTicketCreate.mockResolvedValue({
      id: "t-new",
      ticketNumber: "TK-2025-0001",
      subject: "Build failing",
      description: "The build is failing on main branch since yesterday",
      category: "TECHNIK",
      priority: "HOCH",
      status: "OFFEN",
      createdById: owner.id,
      createdBy: { id: owner.id, name: owner.name, email: owner.email },
      assignedTo: null,
    });

    const req = new Request("http://localhost:3000/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Build failing",
        description: "The build is failing on main branch since yesterday",
        category: "TECHNIK",
        priority: "HOCH",
      }),
    });

    const res = await handler.POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.ticketNumber).toBe("TK-2025-0001");
    expect(body.subject).toBe("Build failing");
  });

  it("generates sequential ticket numbers", async () => {
    const year = new Date().getFullYear();
    mockSession.user = buildOwner();
    mockTicketFindFirst.mockResolvedValue({
      ticketNumber: `TK-${year}-0003`,
    });
    mockTicketCreate.mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "t-new",
          ...args.data,
          createdBy: { id: "u1", name: "User", email: "u@test.com" },
          assignedTo: null,
        }),
    );

    const req = new Request("http://localhost:3000/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Next ticket",
        description: "This should be ticket number 0004",
        category: "SONSTIGES",
      }),
    });

    const res = await handler.POST(req);
    expect(res.status).toBe(201);

    const createArgs = mockTicketCreate.mock.calls[0][0].data;
    expect(createArgs.ticketNumber).toBe(`TK-${year}-0004`);
  });
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/tickets/[id]
   ═══════════════════════════════════════════════════════════════ */

describe("PATCH /api/tickets/[id]", () => {
  let handler: typeof import("@/app/api/tickets/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/tickets/[id]/route");
    mockSession.user = null;
  });

  it("returns 401 when not authenticated", async () => {
    const req = new Request("http://localhost:3000/api/tickets/t1", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockSession.user = buildOwner();
    mockTicketFindFirst.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/tickets/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_BEARBEITUNG" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("allows OWNER to change status", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: owner.workspaceId,
      status: "OFFEN",
      createdById: "someone-else",
      resolvedAt: null,
      closedAt: null,
    });
    mockTicketUpdate.mockResolvedValue({
      id: "t1",
      status: "IN_BEARBEITUNG",
      createdBy: { id: "u1", name: "User", email: "u@test.com" },
      assignedTo: null,
    });

    const req = new Request("http://localhost:3000/api/tickets/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_BEARBEITUNG" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(200);
  });

  it("forbids EMPLOYEE from changing status", async () => {
    const emp = buildEmployee({ id: "emp-1" });
    mockSession.user = emp;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: emp.workspaceId,
      status: "OFFEN",
      createdById: "emp-1",
      resolvedAt: null,
    });

    const req = new Request("http://localhost:3000/api/tickets/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "GELOEST" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(403);
  });

  it("forbids EMPLOYEE from updating another user's ticket", async () => {
    const emp = buildEmployee({ id: "emp-1" });
    mockSession.user = emp;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: emp.workspaceId,
      status: "OFFEN",
      createdById: "other-user",
    });

    const req = new Request("http://localhost:3000/api/tickets/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Updated subject" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(403);
  });

  it("sets resolvedAt when status changes to GELOEST", async () => {
    const admin = buildAdmin();
    mockSession.user = admin;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: admin.workspaceId,
      status: "IN_BEARBEITUNG",
      createdById: "u1",
      resolvedAt: null,
      closedAt: null,
    });
    mockTicketUpdate.mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "t1",
          ...args.data,
          createdBy: { id: "u1", name: "User", email: "u@test.com" },
          assignedTo: null,
        }),
    );

    const req = new Request("http://localhost:3000/api/tickets/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "GELOEST" }),
    });
    await handler.PATCH(req, {
      params: Promise.resolve({ id: "t1" }),
    });

    const updateData = mockTicketUpdate.mock.calls[0][0].data;
    expect(updateData.resolvedAt).toBeInstanceOf(Date);
  });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/tickets/[id]/comments
   ═══════════════════════════════════════════════════════════════ */

describe("POST /api/tickets/[id]/comments", () => {
  let handler: typeof import("@/app/api/tickets/[id]/comments/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/tickets/[id]/comments/route");
    mockSession.user = null;
  });

  it("returns 401 when not authenticated", async () => {
    const req = new Request("http://localhost:3000/api/tickets/t1/comments", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a comment on own ticket as EMPLOYEE", async () => {
    const emp = buildEmployee({ id: "emp-1" });
    mockSession.user = emp;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: emp.workspaceId,
      createdById: "emp-1",
      status: "OFFEN",
    });
    mockTicketCommentCreate.mockResolvedValue({
      id: "c1",
      content: "My comment",
      isInternal: false,
      author: { id: emp.id, name: emp.name, email: emp.email },
    });

    const req = new Request("http://localhost:3000/api/tickets/t1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "My comment" }),
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.content).toBe("My comment");
    expect(body.isInternal).toBe(false);
  });

  it("forbids EMPLOYEE from commenting on other users ticket", async () => {
    const emp = buildEmployee({ id: "emp-1" });
    mockSession.user = emp;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: emp.workspaceId,
      createdById: "other-user",
      status: "OFFEN",
    });

    const req = new Request("http://localhost:3000/api/tickets/t1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "My comment" }),
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(403);
  });

  it("ignores isInternal flag for EMPLOYEE", async () => {
    const emp = buildEmployee({ id: "emp-1" });
    mockSession.user = emp;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: emp.workspaceId,
      createdById: "emp-1",
      status: "OFFEN",
    });
    mockTicketCommentCreate.mockResolvedValue({
      id: "c1",
      content: "My comment",
      isInternal: false,
      author: { id: emp.id, name: emp.name, email: emp.email },
    });

    const req = new Request("http://localhost:3000/api/tickets/t1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "My comment", isInternal: true }),
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(201);

    // isInternal should be false because EMPLOYEE can't post internal notes
    const createArgs = mockTicketCommentCreate.mock.calls[0][0].data;
    expect(createArgs.isInternal).toBe(false);
  });

  it("allows MANAGER to post internal comments", async () => {
    const mgr = buildManager({ id: "mgr-1" });
    mockSession.user = mgr;
    mockTicketFindFirst.mockResolvedValue({
      id: "t1",
      workspaceId: mgr.workspaceId,
      createdById: "emp-1",
      status: "OFFEN",
    });
    mockTicketCommentCreate.mockResolvedValue({
      id: "c1",
      content: "Internal note",
      isInternal: true,
      author: { id: mgr.id, name: mgr.name, email: mgr.email },
    });
    mockTicketUpdate.mockResolvedValue({ id: "t1" });

    const req = new Request("http://localhost:3000/api/tickets/t1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Internal note", isInternal: true }),
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(201);

    const createArgs = mockTicketCommentCreate.mock.calls[0][0].data;
    expect(createArgs.isInternal).toBe(true);
  });
});
