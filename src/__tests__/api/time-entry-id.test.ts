/**
 * @vitest-environment node
 *
 * Tests for GET/PATCH/DELETE /api/time-entries/[id]
 *
 * Covers the bugs fixed in the time-entry deletion session:
 *  - DELETE rejects non-ENTWURF status
 *  - PATCH rejects non-ENTWURF/KORREKTUR status
 *  - Employees cannot read/edit/delete other employees' entries
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindFirst, mockUpdate, mockAuditCreate } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockFindFirst: vi.fn(),
    mockUpdate: vi.fn(),
    mockAuditCreate: vi.fn().mockResolvedValue({ id: "a1" }),
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
    timeEntry: {
      findFirst: mockFindFirst,
      findMany: vi.fn().mockResolvedValue([]), // overlap-guard lookup → no conflicts
      update: mockUpdate,
    },
    auditLog: { create: mockAuditCreate },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        timeEntry: { update: mockUpdate },
        timeEntryAudit: { create: vi.fn() },
      }),
    ),
  },
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
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

const managerUser: SessionUser = {
  id: "u1",
  email: "mgr@test.com",
  workspaceId: "ws1",
  role: "MANAGER",
  employeeId: null,
  name: "Manager",
};

const employeeUser: SessionUser = {
  id: "u2",
  email: "emp@test.com",
  workspaceId: "ws1",
  role: "EMPLOYEE",
  employeeId: "emp1",
  name: "Employee",
};

const makeCtx = (id = "te1") => ({
  params: Promise.resolve({ id }),
});

const draftEntry = {
  id: "te1",
  employeeId: "emp1",
  workspaceId: "ws1",
  status: "ENTWURF",
  startTime: "08:00",
  endTime: "16:00",
  grossMinutes: 480,
  netMinutes: 450,
  breakMinutes: 30,
  date: new Date("2026-01-15"),
  employee: { firstName: "A", lastName: "B" },
  location: null,
  auditLog: [],
};

describe("GET /api/time-entries/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1");
    const res = await GET(req, makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry does not exist", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te99");
    const res = await GET(req, makeCtx("te99"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when employee tries to view another employee's entry", async () => {
    mockSession.user = employeeUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, employeeId: "emp2" });
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1");
    const res = await GET(req, makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 200 with the entry for a manager", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue(draftEntry);
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1");
    const res = await GET(req, makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("te1");
  });

  it("allows employee to view their own entry", async () => {
    mockSession.user = employeeUser;
    mockFindFirst.mockResolvedValue(draftEntry); // employeeId: emp1 matches
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1");
    const res = await GET(req, makeCtx());
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/time-entries/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: "09:00", endTime: "17:00" }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry does not exist", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: "09:00", endTime: "17:00" }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when employee edits another employee's entry", async () => {
    mockSession.user = employeeUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, employeeId: "emp2" });
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: "09:00", endTime: "17:00" }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when entry is not in ENTWURF or KORREKTUR status", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, status: "EINGEREICHT" });
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: "09:00", endTime: "17:00" }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid update of ENTWURF entry", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue(draftEntry);
    mockUpdate.mockResolvedValue({
      ...draftEntry,
      startTime: "09:00",
      endTime: "17:00",
    });
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: "09:00",
        endTime: "17:00",
        date: "2026-05-30",
      }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(200);
  });

  it("allows editing KORREKTUR entries", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, status: "KORREKTUR" });
    mockUpdate.mockResolvedValue({
      ...draftEntry,
      status: "KORREKTUR",
      startTime: "09:00",
    });
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: "09:00",
        endTime: "17:00",
        date: "2026-05-30",
      }),
    });
    const res = await PATCH(req, makeCtx());
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/time-entries/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry does not exist", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when employee deletes another employee's entry", async () => {
    mockSession.user = employeeUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, employeeId: "emp2" });
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when entry is KORREKTUR (not deletable)", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, status: "KORREKTUR" });
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/draft/i);
  });

  it("returns 400 when entry is EINGEREICHT (not deletable)", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue({ ...draftEntry, status: "EINGEREICHT" });
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(400);
  });

  it("soft-deletes an ENTWURF entry and returns success", async () => {
    mockSession.user = managerUser;
    mockFindFirst.mockResolvedValue(draftEntry);
    mockUpdate.mockResolvedValue({ ...draftEntry, deletedAt: new Date() });
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("allows employee to delete their own ENTWURF entry", async () => {
    mockSession.user = employeeUser;
    mockFindFirst.mockResolvedValue(draftEntry); // employeeId: emp1 matches
    mockUpdate.mockResolvedValue({ ...draftEntry, deletedAt: new Date() });
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const req = new Request("http://localhost/api/time-entries/te1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeCtx());
    expect(res.status).toBe(200);
  });
});
