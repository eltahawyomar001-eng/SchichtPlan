/**
 * @vitest-environment node
 *
 * Tests for the Auto-Fill & Recovery Engine.
 * Covers: auto-fill logic, cascade → auto-fill trigger,
 * shift confirmation, manager alerts, swap compliance.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ── */
const {
  mockSession,
  mockShiftFindFirst,
  mockShiftFindMany,
  mockShiftUpdate,
  mockShiftUpdateMany,
  mockEmployeeFindUnique,
  mockWorkspaceFindUnique,
  mockAutoFillLogCreate,
  mockAutoFillLogUpdate,
  mockManagerAlertCreate,
  mockManagerAlertFindMany,
  mockManagerAlertFindFirst,
  mockManagerAlertUpdate,
  mockManagerAlertDeleteMany,
  mockManagerAlertCount,
  mockSwapFindFirst,
  mockNotificationCreate,
  mockNotificationFindMany,
  mockNotificationPrefFindFirst,
  mockUserFindMany,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockShiftFindFirst: vi.fn(),
  mockShiftFindMany: vi.fn(),
  mockShiftUpdate: vi.fn(),
  mockShiftUpdateMany: vi.fn(),
  mockEmployeeFindUnique: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockAutoFillLogCreate: vi.fn(),
  mockAutoFillLogUpdate: vi.fn(),
  mockManagerAlertCreate: vi.fn(),
  mockManagerAlertFindMany: vi.fn(),
  mockManagerAlertFindFirst: vi.fn(),
  mockManagerAlertUpdate: vi.fn(),
  mockManagerAlertDeleteMany: vi.fn(),
  mockManagerAlertCount: vi.fn(),
  mockSwapFindFirst: vi.fn(),
  mockNotificationCreate: vi.fn(),
  mockNotificationFindMany: vi.fn(),
  mockNotificationPrefFindFirst: vi.fn(),
  mockUserFindMany: vi.fn(),
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

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    shift: {
      findFirst: mockShiftFindFirst,
      findMany: mockShiftFindMany,
      findUnique: mockShiftFindFirst,
      update: mockShiftUpdate,
      updateMany: mockShiftUpdateMany,
    },
    employee: {
      findUnique: mockEmployeeFindUnique,
    },
    workspace: {
      findUnique: mockWorkspaceFindUnique,
    },
    autoFillLog: {
      create: mockAutoFillLogCreate,
      update: mockAutoFillLogUpdate,
    },
    managerAlert: {
      create: mockManagerAlertCreate,
      findMany: mockManagerAlertFindMany,
      findFirst: mockManagerAlertFindFirst,
      update: mockManagerAlertUpdate,
      deleteMany: mockManagerAlertDeleteMany,
      count: mockManagerAlertCount,
    },
    shiftSwapRequest: {
      findFirst: mockSwapFindFirst,
    },
    notification: {
      create: mockNotificationCreate,
      createMany: vi.fn(),
      findMany: mockNotificationFindMany,
    },
    notificationPreference: {
      findFirst: mockNotificationPrefFindFirst,
    },
    user: {
      findMany: mockUserFindMany,
      findUnique: vi.fn().mockResolvedValue(null),
    },
    automationSetting: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock external notification dispatch (email/push) to avoid side effects
vi.mock("@/lib/notifications", () => ({
  dispatchExternalNotification: vi.fn(),
  sendEmail: vi.fn(),
}));

// Mock auto-scheduler backfill
const mockRunBackfill = vi.fn();
vi.mock("@/lib/auto-scheduler", () => ({
  runBackfill: mockRunBackfill,
}));

// Mock audit log
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
}));

// Mock automations for the API routes (not auto-fill itself)
const mockCreateSystemNotification = vi.fn().mockResolvedValue(undefined);
const mockCheckShiftConflicts = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/automations", () => ({
  createSystemNotification: mockCreateSystemNotification,
  checkShiftConflicts: mockCheckShiftConflicts,
  isAutomationEnabled: vi.fn(() => Promise.resolve(true)),
  executeCustomRules: vi.fn(),
}));

// Mock auto-fill's dependency on automations (re-exported)
vi.mock("@/lib/auto-fill", async () => {
  const actual = await vi.importActual("@/lib/auto-fill");
  return actual;
});

import { buildOwner, buildManager, buildEmployee } from "../helpers/factories";

/* ═══════════════════════════════════════════════════════════════
   1. Auto-Fill Engine — findAndAssignReplacement
   ═══════════════════════════════════════════════════════════════ */

describe("Auto-Fill Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceFindUnique.mockResolvedValue({ bundesland: "HE" });
    mockAutoFillLogCreate.mockResolvedValue({ id: "fill-1" });
    mockAutoFillLogUpdate.mockResolvedValue({});
    mockNotificationCreate.mockResolvedValue({});
    mockNotificationPrefFindFirst.mockResolvedValue(null);
    mockUserFindMany.mockResolvedValue([]);
  });

  it("assigns top candidate when replacements are available", async () => {
    const { findAndAssignReplacement } = await import("@/lib/auto-fill");

    // Shift is 10 days away (not emergency)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    mockShiftFindFirst.mockResolvedValue({
      id: "shift-1",
      date: futureDate,
      startTime: "09:00",
      endTime: "17:00",
      employeeId: "emp-old",
      status: "SCHEDULED",
      location: { name: "Berlin HQ" },
    });

    mockShiftUpdate.mockResolvedValue({});

    mockRunBackfill.mockResolvedValue({
      shiftId: "shift-1",
      candidates: [
        {
          employeeId: "emp-new",
          employeeName: "Anna Schmidt",
          score: 85,
          reasons: ["Best availability", "Fairness balance"],
          costEstimate: 120,
        },
      ],
      totalCandidates: 3,
    });

    mockEmployeeFindUnique.mockResolvedValueOnce({
      firstName: "Max",
      lastName: "Müller",
    });
    mockEmployeeFindUnique.mockResolvedValueOnce({
      email: "anna@test.de",
      firstName: "Anna",
      lastName: "Schmidt",
    });

    const result = await findAndAssignReplacement({
      shiftId: "shift-1",
      vacatedByEmployeeId: "emp-old",
      reason: "Genehmigte Abwesenheit von Max Müller",
      workspaceId: "ws-1",
    });

    expect(result.success).toBe(true);
    expect(result.assignedToEmployeeId).toBe("emp-new");
    expect(result.assignedToEmployeeName).toBe("Anna Schmidt");
    expect(result.isEmergency).toBe(false);
    expect(result.candidatesEvaluated).toBe(3);

    // Shift should have been set to OPEN first, then reassigned
    expect(mockShiftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "shift-1" },
        data: { employeeId: null, status: "OPEN" },
      }),
    );
    expect(mockShiftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "shift-1" },
        data: { employeeId: "emp-new", status: "SCHEDULED" },
      }),
    );

    // AutoFillLog should be created and updated to ASSIGNED
    expect(mockAutoFillLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftId: "shift-1",
          status: "PENDING",
          vacatedByEmployeeId: "emp-old",
        }),
      }),
    );
    expect(mockAutoFillLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ASSIGNED",
          assignedToEmployeeId: "emp-new",
        }),
      }),
    );
  });

  it("detects emergency when shift is < 4 days away", async () => {
    const { findAndAssignReplacement } = await import("@/lib/auto-fill");

    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    mockShiftFindFirst.mockResolvedValue({
      id: "shift-2",
      date: tomorrowDate,
      startTime: "06:00",
      endTime: "14:00",
      employeeId: "emp-sick",
      status: "SCHEDULED",
      location: null,
    });

    mockShiftUpdate.mockResolvedValue({});

    mockRunBackfill.mockResolvedValue({
      shiftId: "shift-2",
      candidates: [
        {
          employeeId: "emp-fill",
          employeeName: "Lisa Weber",
          score: 72,
          reasons: ["Available"],
          costEstimate: 90,
        },
      ],
      totalCandidates: 1,
    });

    mockEmployeeFindUnique.mockResolvedValueOnce({
      firstName: "Karl",
      lastName: "Braun",
    });
    mockEmployeeFindUnique.mockResolvedValueOnce({
      email: "lisa@test.de",
      firstName: "Lisa",
      lastName: "Weber",
    });

    const result = await findAndAssignReplacement({
      shiftId: "shift-2",
      vacatedByEmployeeId: "emp-sick",
      reason: "Krankmeldung Karl Braun",
      workspaceId: "ws-1",
    });

    expect(result.success).toBe(true);
    expect(result.isEmergency).toBe(true);
  });

  it("triggers 'No One Available' protocol when no candidates found", async () => {
    const { findAndAssignReplacement } = await import("@/lib/auto-fill");

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    mockShiftFindFirst.mockResolvedValue({
      id: "shift-3",
      date: futureDate,
      startTime: "14:00",
      endTime: "22:00",
      employeeId: "emp-absent",
      status: "SCHEDULED",
      location: { name: "München" },
    });

    mockShiftUpdate.mockResolvedValue({});
    mockManagerAlertCreate.mockResolvedValue({ id: "alert-1" });

    // No candidates available
    mockRunBackfill.mockResolvedValue({
      shiftId: "shift-3",
      candidates: [],
      totalCandidates: 0,
    });

    const result = await findAndAssignReplacement({
      shiftId: "shift-3",
      vacatedByEmployeeId: "emp-absent",
      reason: "Urlaub genehmigt",
      workspaceId: "ws-1",
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("Kein Mitarbeiter verfügbar");
    expect(result.candidatesEvaluated).toBe(0);

    // Manager alert should be created
    expect(mockManagerAlertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "NO_REPLACEMENT",
          severity: "WARNING",
          workspaceId: "ws-1",
        }),
      }),
    );

    // AutoFillLog should be FAILED
    expect(mockAutoFillLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
        }),
      }),
    );
  });

  it("returns early when shift not found", async () => {
    const { findAndAssignReplacement } = await import("@/lib/auto-fill");

    mockShiftFindFirst.mockResolvedValue(null);

    const result = await findAndAssignReplacement({
      shiftId: "nonexistent",
      reason: "Test",
      workspaceId: "ws-1",
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("Shift not found");
  });
});

/* ═══════════════════════════════════════════════════════════════
   2. Shift Confirmation API — POST /api/shifts/[id]/confirm
   ═══════════════════════════════════════════════════════════════ */

describe("POST /api/shifts/[id]/confirm", () => {
  let handler: typeof import("@/app/api/shifts/[id]/confirm/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shifts/[id]/confirm/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/shifts/s1/confirm", {
      method: "POST",
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when shift not found", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    mockShiftFindFirst.mockResolvedValue(null);

    const req = new Request("http://localhost/api/shifts/s1/confirm", {
      method: "POST",
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when employee tries to confirm another's shift", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    mockShiftFindFirst.mockResolvedValue({
      id: "s1",
      employeeId: "emp-other",
      status: "SCHEDULED",
    });

    const req = new Request("http://localhost/api/shifts/s1/confirm", {
      method: "POST",
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when shift is not SCHEDULED", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    mockShiftFindFirst.mockResolvedValue({
      id: "s1",
      employeeId: "emp-1",
      status: "CONFIRMED",
    });

    const req = new Request("http://localhost/api/shifts/s1/confirm", {
      method: "POST",
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(400);
  });

  it("confirms a SCHEDULED shift successfully", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });
    mockShiftFindFirst.mockResolvedValue({
      id: "s1",
      employeeId: "emp-1",
      status: "SCHEDULED",
    });
    mockShiftUpdate.mockResolvedValue({
      id: "s1",
      status: "CONFIRMED",
    });

    const req = new Request("http://localhost/api/shifts/s1/confirm", {
      method: "POST",
    });
    const res = await handler.POST(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("CONFIRMED");
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. Manager Alerts API — GET /api/manager-alerts
   ═══════════════════════════════════════════════════════════════ */

describe("GET /api/manager-alerts", () => {
  let handler: typeof import("@/app/api/manager-alerts/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/manager-alerts/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/manager-alerts");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE role", async () => {
    mockSession.user = buildEmployee({ workspaceId: "ws-1" });
    const req = new Request("http://localhost/api/manager-alerts");
    const res = await handler.GET(req);
    expect(res.status).toBe(403);
  });

  it("returns alerts for manager", async () => {
    mockSession.user = buildManager({ workspaceId: "ws-1" });
    mockManagerAlertFindMany.mockResolvedValue([
      {
        id: "alert-1",
        type: "NO_REPLACEMENT",
        title: "Keine Vertretung",
        severity: "URGENT",
        acknowledged: false,
      },
    ]);
    mockManagerAlertCount.mockResolvedValue(1);

    const req = new Request("http://localhost/api/manager-alerts");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].type).toBe("NO_REPLACEMENT");
  });
});

/* ═══════════════════════════════════════════════════════════════
   4. Manager Alerts — PATCH /api/manager-alerts/[id]
   ═══════════════════════════════════════════════════════════════ */

describe("PATCH /api/manager-alerts/[id]", () => {
  let handler: typeof import("@/app/api/manager-alerts/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/manager-alerts/[id]/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/manager-alerts/a1", {
      method: "PATCH",
      body: JSON.stringify({ acknowledged: true }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE", async () => {
    mockSession.user = buildEmployee({ workspaceId: "ws-1" });
    const req = new Request("http://localhost/api/manager-alerts/a1", {
      method: "PATCH",
      body: JSON.stringify({ acknowledged: true }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(403);
  });

  it("acknowledges alert successfully", async () => {
    mockSession.user = buildOwner({ workspaceId: "ws-1" });
    mockManagerAlertFindFirst.mockResolvedValue({
      id: "a1",
      acknowledged: false,
    });
    mockManagerAlertUpdate.mockResolvedValue({
      id: "a1",
      acknowledged: true,
    });

    const req = new Request("http://localhost/api/manager-alerts/a1", {
      method: "PATCH",
      body: JSON.stringify({ acknowledged: true }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.acknowledged).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
   5. Swap Compliance — concurrent swap detection
   ═══════════════════════════════════════════════════════════════ */

describe("POST /api/shift-swaps — compliance", () => {
  let handler: typeof import("@/app/api/shift-swaps/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-swaps/route");
  });

  it("rejects swap when a pending request already exists for the shift", async () => {
    mockSession.user = buildEmployee({
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });

    mockShiftFindFirst.mockResolvedValue({
      id: "shift-1",
      workspaceId: "ws-1",
      employeeId: "emp-1",
    });

    // Existing pending swap
    mockSwapFindFirst.mockResolvedValue({
      id: "swap-existing",
      status: "ANGEFRAGT",
    });

    const req = new Request("http://localhost/api/shift-swaps", {
      method: "POST",
      body: JSON.stringify({
        shiftId: "shift-1",
        requesterId: "emp-1",
      }),
    });

    const res = await handler.POST(req);
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error).toContain("offener Tauschantrag");
  });
});
