/**
 * @vitest-environment node
 *
 * Tests for the time-entry status workflow:
 *   POST /api/time-entries/[id]/status
 *
 * Workflow:
 *   ENTWURF → EINGEREICHT → GEPRUEFT → BESTAETIGT
 *                  ↓  ↑ (correction loop)
 *               KORREKTUR
 *                  ↓
 *            ZURUECKGEWIESEN
 *
 * Guards: month-lock, role checks, invalid transition rejection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ── */
const {
  mockSession,
  mockTimeEntryFindFirst,
  mockTimeEntryUpdate,
  mockTimeEntryAuditCreate,
  mockIsMonthLocked,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockTimeEntryFindFirst: vi.fn(),
  mockTimeEntryUpdate: vi.fn(),
  mockTimeEntryAuditCreate: vi.fn(),
  mockIsMonthLocked: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/db", () => {
  const tx = {
    timeEntry: {
      findFirst: mockTimeEntryFindFirst,
      update: mockTimeEntryUpdate,
    },
    timeEntryAudit: {
      create: mockTimeEntryAuditCreate,
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

vi.mock("@/lib/automations", () => ({
  recalculateTimeAccount: vi.fn().mockResolvedValue(undefined),
  isMonthLocked: (...args: unknown[]) => mockIsMonthLocked(...args),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/subscription", () => ({
  canUseFeature: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/e-signature", () => ({
  createESignature: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildManager, buildEmployee } from "../helpers/factories";

/* ── Helpers ── */
function statusReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/time-entries/te-1/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ id: "te-1" }) };

const baseEntry = {
  id: "te-1",
  employeeId: "emp-1",
  workspaceId: "ws-1",
  date: new Date("2025-03-10"),
  employee: { firstName: "Max", lastName: "M", email: "m@t.de" },
};

/* ══════════════════════════════════════════════════════════════════
   POST /api/time-entries/[id]/status
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/time-entries/[id]/status", () => {
  let handler: typeof import("@/app/api/time-entries/[id]/status/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIsMonthLocked.mockReturnValue(false); // default: not locked
    mockTimeEntryAuditCreate.mockResolvedValue({ id: "audit-1" });
    handler = await import("@/app/api/time-entries/[id]/status/route");
  });

  // ── Auth ──

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry does not exist", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue(null);

    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(404);
  });

  // ── Month lock guard ──

  it("returns 403 when month is locked", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "ENTWURF",
    });
    mockIsMonthLocked.mockReturnValue(true);

    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });

  // ── Valid transitions ──

  it("submit: ENTWURF → EINGEREICHT", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "ENTWURF",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("EINGEREICHT");
    expect(updateCall.data.submittedAt).toBeInstanceOf(Date);
  });

  it("submit: KORREKTUR → EINGEREICHT (resubmit after correction)", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "KORREKTUR",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("EINGEREICHT");
  });

  it("approve: EINGEREICHT → GEPRUEFT", async () => {
    mockSession.user = buildManager({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    const res = await handler.POST(
      statusReq({ action: "approve" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("GEPRUEFT");
  });

  it("reject: EINGEREICHT → ZURUECKGEWIESEN", async () => {
    mockSession.user = buildManager({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    const res = await handler.POST(
      statusReq({ action: "reject", comment: "Fehlende Pausenzeit" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("ZURUECKGEWIESEN");
  });

  it("correct: EINGEREICHT → KORREKTUR", async () => {
    mockSession.user = buildManager({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    const res = await handler.POST(
      statusReq({ action: "correct" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("KORREKTUR");
  });

  it("confirm: GEPRUEFT → BESTAETIGT", async () => {
    const user = buildAdmin({ workspaceId: "ws-1" });
    mockSession.user = user;
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "GEPRUEFT",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    const res = await handler.POST(
      statusReq({ action: "confirm" }),
      routeParams,
    );
    expect(res.status).toBe(200);
    const updateCall = mockTimeEntryUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("BESTAETIGT");
    expect(updateCall.data.confirmedAt).toBeInstanceOf(Date);
    expect(updateCall.data.confirmedBy).toBe(user.id);
  });

  // ── Invalid transitions ──

  it("rejects submit when already EINGEREICHT", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });

    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(400);
  });

  it("rejects approve when in ENTWURF", async () => {
    mockSession.user = buildManager({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "ENTWURF",
    });

    const res = await handler.POST(
      statusReq({ action: "approve" }),
      routeParams,
    );
    expect(res.status).toBe(400);
  });

  it("rejects confirm when in EINGEREICHT (must approve first)", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });

    const res = await handler.POST(
      statusReq({ action: "confirm" }),
      routeParams,
    );
    expect(res.status).toBe(400);
  });

  it("rejects confirm when already BESTAETIGT", async () => {
    mockSession.user = buildAdmin({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "BESTAETIGT",
    });

    const res = await handler.POST(
      statusReq({ action: "confirm" }),
      routeParams,
    );
    expect(res.status).toBe(400);
  });

  // ── Role checks ──

  it("EMPLOYEE cannot approve", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });

    const res = await handler.POST(
      statusReq({ action: "approve" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });

  it("EMPLOYEE cannot confirm", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-1",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "GEPRUEFT",
    });

    const res = await handler.POST(
      statusReq({ action: "confirm" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });

  it("EMPLOYEE cannot submit another employee's entry", async () => {
    mockSession.user = buildEmployee({
      employeeId: "emp-2",
      workspaceId: "ws-1",
    });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "ENTWURF",
      employeeId: "emp-1", // different from user's emp-2
    });

    const res = await handler.POST(
      statusReq({ action: "submit" }),
      routeParams,
    );
    expect(res.status).toBe(403);
  });

  // ── Audit log ──

  it("creates audit log entry on transition", async () => {
    mockSession.user = buildManager({ workspaceId: "ws-1" });
    mockTimeEntryFindFirst.mockResolvedValue({
      ...baseEntry,
      status: "EINGEREICHT",
    });
    mockTimeEntryUpdate.mockImplementation((args) =>
      Promise.resolve({ ...baseEntry, ...args.data }),
    );

    await handler.POST(
      statusReq({ action: "approve", comment: "OK" }),
      routeParams,
    );

    expect(mockTimeEntryAuditCreate).toHaveBeenCalledOnce();
    const auditCall = mockTimeEntryAuditCreate.mock.calls[0][0];
    expect(auditCall.data.action).toBe("APPROVED");
    expect(auditCall.data.comment).toBe("OK");
    expect(auditCall.data.timeEntryId).toBe("te-1");
  });
});
