/**
 * @vitest-environment node
 *
 * Tests for the Absences API:
 *   GET  /api/absences          – list absences
 *   POST /api/absences          – create absence request
 *   PATCH /api/absences/[id]    – approve/reject/cancel
 *   DELETE /api/absences/[id]   – delete absence
 *
 * Critical business flow: leave management directly affects payroll
 * and workforce availability.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ── */
const {
  mockSession,
  mockAbsenceFindMany,
  mockAbsenceCount,
  mockAbsenceFindFirst,
  mockAbsenceFindUnique,
  mockAbsenceCreate,
  mockAbsenceUpdate,
  mockAbsenceDelete,
  mockEmployeeFindFirst,
  mockRequirePlanFeature,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockAbsenceFindMany: vi.fn(),
  mockAbsenceCount: vi.fn(),
  mockAbsenceFindFirst: vi.fn(),
  mockAbsenceFindUnique: vi.fn(),
  mockAbsenceCreate: vi.fn(),
  mockAbsenceUpdate: vi.fn(),
  mockAbsenceDelete: vi.fn(),
  mockEmployeeFindFirst: vi.fn(),
  mockRequirePlanFeature: vi.fn(),
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

vi.mock("@/lib/db", () => {
  const tx = {
    absenceRequest: {
      findMany: mockAbsenceFindMany,
      count: mockAbsenceCount,
      findFirst: mockAbsenceFindFirst,
      findUnique: mockAbsenceFindUnique,
      create: mockAbsenceCreate,
      update: mockAbsenceUpdate,
      delete: mockAbsenceDelete,
    },
    employee: {
      findFirst: mockEmployeeFindFirst,
    },
  };
  return {
    prisma: {
      ...tx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn((cb: (t: any) => Promise<any>) => cb(tx)),
    },
  };
});

vi.mock("@/lib/subscription", () => ({
  requirePlanFeature: (...args: unknown[]) => mockRequirePlanFeature(...args),
}));

vi.mock("@/lib/automations", () => ({
  tryAutoApproveAbsence: vi.fn().mockResolvedValue(false),
  cascadeAbsenceApproval: vi
    .fn()
    .mockResolvedValue({ cancelledShifts: 0, adjustedBalance: 0 }),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
  executeCustomRules: vi.fn(),
}));

vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/e-signature", () => ({
  createESignature: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
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

import { buildOwner, buildAdmin, buildEmployee } from "../helpers/factories";

/* ── Helpers ── */
function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/absences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/absences/abs-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validAbsenceBody = {
  employeeId: "emp-1",
  category: "URLAUB",
  startDate: "2025-03-10",
  endDate: "2025-03-14",
};

/* ══════════════════════════════════════════════════════════════════
   POST /api/absences
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/absences", () => {
  let handler: typeof import("@/app/api/absences/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePlanFeature.mockResolvedValue(null);
    handler = await import("@/app/api/absences/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq(validAbsenceBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no workspace", async () => {
    mockSession.user = buildOwner({ workspaceId: undefined });
    const res = await handler.POST(postReq(validAbsenceBody));
    expect(res.status).toBe(400);
  });

  it("returns plan gate response when feature is not available", async () => {
    mockSession.user = buildOwner();
    const { NextResponse } = await import("next/server");
    mockRequirePlanFeature.mockResolvedValue(
      NextResponse.json({ error: "Plan upgrade required" }, { status: 403 }),
    );
    const res = await handler.POST(postReq(validAbsenceBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid category", async () => {
    mockSession.user = buildOwner();
    const res = await handler.POST(
      postReq({ ...validAbsenceBody, category: "INVALID" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when endDate is before startDate", async () => {
    mockSession.user = buildOwner();
    const res = await handler.POST(
      postReq({
        ...validAbsenceBody,
        startDate: "2025-03-14",
        endDate: "2025-03-10",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates an absence and returns 201", async () => {
    mockSession.user = buildAdmin();
    mockAbsenceFindFirst.mockResolvedValue(null); // no overlap
    const created = {
      id: "abs-1",
      ...validAbsenceBody,
      status: "AUSSTEHEND",
      totalDays: 5,
      employee: { firstName: "Max", lastName: "Mustermann", email: "m@t.de" },
    };
    mockAbsenceCreate.mockResolvedValue(created);

    const res = await handler.POST(postReq(validAbsenceBody));
    expect(res.status).toBe(201);
    expect(mockAbsenceCreate).toHaveBeenCalledOnce();
  });

  it("calculates totalDays correctly (weekdays only)", async () => {
    mockSession.user = buildAdmin();
    mockAbsenceFindFirst.mockResolvedValue(null);
    mockAbsenceCreate.mockImplementation((args) =>
      Promise.resolve({
        id: "abs-1",
        ...args.data,
        employee: { firstName: "Max", lastName: "M", email: "m@t.de" },
      }),
    );

    // Mon-Fri = 5 weekdays
    await handler.POST(
      postReq({
        ...validAbsenceBody,
        startDate: "2025-03-10", // Monday
        endDate: "2025-03-14", // Friday
      }),
    );

    const createCall = mockAbsenceCreate.mock.calls[0][0];
    expect(createCall.data.totalDays).toBe(5);
  });

  it("adjusts totalDays for half days", async () => {
    mockSession.user = buildAdmin();
    mockAbsenceFindFirst.mockResolvedValue(null);
    mockAbsenceCreate.mockImplementation((args) =>
      Promise.resolve({
        id: "abs-1",
        ...args.data,
        employee: { firstName: "Max", lastName: "M", email: "m@t.de" },
      }),
    );

    // Mon-Fri = 5 days, half start + half end = -1.0
    await handler.POST(
      postReq({
        ...validAbsenceBody,
        startDate: "2025-03-10",
        endDate: "2025-03-14",
        halfDayStart: true,
        halfDayEnd: true,
      }),
    );

    const createCall = mockAbsenceCreate.mock.calls[0][0];
    expect(createCall.data.totalDays).toBe(4);
  });

  it("returns 409 when there is an overlapping absence", async () => {
    mockSession.user = buildAdmin();
    mockAbsenceFindFirst.mockResolvedValue({
      id: "existing-abs",
      status: "GENEHMIGT",
    });

    const res = await handler.POST(postReq(validAbsenceBody));
    expect(res.status).toBe(409);
  });

  it("EMPLOYEE can only create own absences", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    const res = await handler.POST(
      postReq({ ...validAbsenceBody, employeeId: "emp-other" }),
    );
    expect(res.status).toBe(403);
  });

  it("EMPLOYEE can create absence for themselves", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockAbsenceFindFirst.mockResolvedValue(null);
    mockAbsenceCreate.mockResolvedValue({
      id: "abs-1",
      employeeId: "emp-1",
      status: "AUSSTEHEND",
      employee: { firstName: "Max", lastName: "M", email: "m@t.de" },
    });

    const res = await handler.POST(
      postReq({ ...validAbsenceBody, employeeId: "emp-1" }),
    );
    expect(res.status).toBe(201);
  });
});

/* ══════════════════════════════════════════════════════════════════
   GET /api/absences
   ══════════════════════════════════════════════════════════════════ */

describe("GET /api/absences", () => {
  let handler: typeof import("@/app/api/absences/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/absences/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/absences"));
    expect(res.status).toBe(401);
  });

  it("returns absences for management users", async () => {
    mockSession.user = buildAdmin();
    const absences = [{ id: "abs-1", employeeId: "emp-1", category: "URLAUB" }];
    mockAbsenceFindMany.mockResolvedValue(absences);
    mockAbsenceCount.mockResolvedValue(1);

    const res = await handler.GET(new Request("http://localhost/api/absences"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("EMPLOYEE only sees own absences", async () => {
    const empUser = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockSession.user = empUser;
    mockAbsenceFindMany.mockResolvedValue([]);
    mockAbsenceCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/absences"));
    // Verify the where clause scoped to employeeId
    const findManyCall = mockAbsenceFindMany.mock.calls[0][0];
    expect(findManyCall.where.employeeId).toBe("emp-1");
  });
});

/* ══════════════════════════════════════════════════════════════════
   PATCH /api/absences/[id] — approve / reject / cancel
   ══════════════════════════════════════════════════════════════════ */

describe("PATCH /api/absences/[id]", () => {
  let handler: typeof import("@/app/api/absences/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/absences/[id]/route");
  });

  const routeParams = { params: Promise.resolve({ id: "abs-1" }) };

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.PATCH(
      patchReq({ status: "GENEHMIGT" }),
      routeParams,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when absence does not exist", async () => {
    mockSession.user = buildAdmin();
    mockAbsenceFindUnique.mockResolvedValue(null);

    const res = await handler.PATCH(
      patchReq({ status: "GENEHMIGT" }),
      routeParams,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when absence belongs to different workspace", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-other",
    });

    const res = await handler.PATCH(
      patchReq({ status: "GENEHMIGT" }),
      routeParams,
    );
    expect(res.status).toBe(404);
  });

  it("approves an absence (sets reviewedBy, reviewedAt)", async () => {
    const user = buildAdmin({ workspaceId: "ws-1" });
    mockSession.user = user;
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-1",
      status: "AUSSTEHEND",
      startDate: new Date("2025-03-10"),
      endDate: new Date("2025-03-14"),
      totalDays: 5,
      category: "URLAUB",
    });
    mockAbsenceUpdate.mockResolvedValue({
      id: "abs-1",
      status: "GENEHMIGT",
      employee: { email: "e@t.de" },
    });

    const res = await handler.PATCH(
      patchReq({ status: "GENEHMIGT" }),
      routeParams,
    );
    expect(res.status).toBe(200);

    const updateCall = mockAbsenceUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("GENEHMIGT");
    expect(updateCall.data.reviewedBy).toBe(user.id);
    expect(updateCall.data.reviewedAt).toBeInstanceOf(Date);
  });

  it("rejects an absence with review note", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-1",
      status: "AUSSTEHEND",
    });
    mockAbsenceUpdate.mockResolvedValue({
      id: "abs-1",
      status: "ABGELEHNT",
      employee: { email: "e@t.de" },
    });

    const res = await handler.PATCH(
      patchReq({
        status: "ABGELEHNT",
        reviewNote: "Zu viele Mitarbeiter fehlen",
      }),
      routeParams,
    );
    expect(res.status).toBe(200);

    const updateCall = mockAbsenceUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("ABGELEHNT");
    expect(updateCall.data.reviewNote).toBe("Zu viele Mitarbeiter fehlen");
  });

  it("EMPLOYEE can cancel their own absence", async () => {
    const empUser = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
      email: "e@t.de",
    });
    mockSession.user = empUser;
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp-1" });
    mockAbsenceUpdate.mockResolvedValue({
      id: "abs-1",
      status: "STORNIERT",
      employee: { email: "e@t.de" },
    });

    const res = await handler.PATCH(
      patchReq({ status: "STORNIERT" }),
      routeParams,
    );
    expect(res.status).toBe(200);
  });

  it("EMPLOYEE cannot cancel another's absence", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
      email: "e@t.de",
    });
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-other",
    });
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp-1" });

    const res = await handler.PATCH(
      patchReq({ status: "STORNIERT" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid status value", async () => {
    mockSession.user = buildAdmin();
    const res = await handler.PATCH(
      patchReq({ status: "INVALID_STATUS" }),
      routeParams,
    );
    expect(res.status).toBe(400);
  });

  it("EMPLOYEE cannot approve absences (requirePermission)", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });

    const res = await handler.PATCH(
      patchReq({ status: "GENEHMIGT" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });
});

/* ══════════════════════════════════════════════════════════════════
   DELETE /api/absences/[id]
   ══════════════════════════════════════════════════════════════════ */

describe("DELETE /api/absences/[id]", () => {
  let handler: typeof import("@/app/api/absences/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/absences/[id]/route");
  });

  const routeParams = { params: Promise.resolve({ id: "abs-1" }) };

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.DELETE(
      new Request("http://localhost/api/absences/abs-1", { method: "DELETE" }),
      routeParams,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when absence does not exist", async () => {
    mockSession.user = buildAdmin();
    mockAbsenceFindUnique.mockResolvedValue(null);
    const res = await handler.DELETE(
      new Request("http://localhost/api/absences/abs-1", { method: "DELETE" }),
      routeParams,
    );
    expect(res.status).toBe(404);
  });

  it("admin can delete any absence", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-other",
    });
    mockAbsenceDelete.mockResolvedValue({ id: "abs-1" });

    const res = await handler.DELETE(
      new Request("http://localhost/api/absences/abs-1", { method: "DELETE" }),
      routeParams,
    );
    expect(res.status).toBe(200);
  });

  it("EMPLOYEE cannot delete another employee's absence", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
      email: "e@t.de",
    });
    mockAbsenceFindUnique.mockResolvedValue({
      id: "abs-1",
      workspaceId: "ws-1",
      employeeId: "emp-other",
    });
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp-1" });

    const res = await handler.DELETE(
      new Request("http://localhost/api/absences/abs-1", { method: "DELETE" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });
});
