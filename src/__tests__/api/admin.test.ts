/**
 * Tests for /api/admin/workspace-wipe (DELETE) and
 * /api/admin/data-retention (POST, GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    verificationToken: { deleteMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    invitation: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    eSignature: { deleteMany: vi.fn() },
    chatMessage: { deleteMany: vi.fn() },
    exportJob: { deleteMany: vi.fn() },
    serviceVisitAuditLog: { deleteMany: vi.fn() },
    timeEntryAudit: { deleteMany: vi.fn() },
    autoFillLog: { deleteMany: vi.fn() },
    managerAlert: { deleteMany: vi.fn() },
    autoScheduleRun: { deleteMany: vi.fn() },
    pushSubscription: { deleteMany: vi.fn() },
    workspace: { delete: vi.fn() },
    // Workspace wipe chain
    shiftChangeRequest: { deleteMany: vi.fn() },
    shiftSwapRequest: { deleteMany: vi.fn() },
    availabilityEntry: { deleteMany: vi.fn() },
    vacationBalance: { deleteMany: vi.fn() },
    timeAccount: { deleteMany: vi.fn() },
    timeEntry: { deleteMany: vi.fn() },
    shift: { deleteMany: vi.fn() },
    absenceRequest: { deleteMany: vi.fn() },
    employee: { deleteMany: vi.fn() },
    department: { deleteMany: vi.fn() },
    location: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
  cronMonitor: vi.fn(() => ({ start: vi.fn(), error: vi.fn(), ok: vi.fn() })),
}));

import { buildOwner, buildAdmin, buildEmployee } from "../helpers/factories";

// ── /api/admin/workspace-wipe ──
describe("DELETE /api/admin/workspace-wipe", () => {
  let handler: typeof import("@/app/api/admin/workspace-wipe/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/admin/workspace-wipe/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/admin/workspace-wipe", {
      method: "DELETE",
      body: JSON.stringify({ confirm: "DELETE-ws1" }),
    });
    const res = await handler.DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-OWNER", async () => {
    mockSession.user = buildAdmin();
    const req = new Request("http://localhost/api/admin/workspace-wipe", {
      method: "DELETE",
      body: JSON.stringify({ confirm: "DELETE-ws1" }),
    });
    const res = await handler.DELETE(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when confirmation string is wrong", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const req = new Request("http://localhost/api/admin/workspace-wipe", {
      method: "DELETE",
      body: JSON.stringify({ confirm: "WRONG" }),
    });
    const res = await handler.DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 for EMPLOYEE", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/admin/workspace-wipe", {
      method: "DELETE",
      body: JSON.stringify({ confirm: "DELETE-ws1" }),
    });
    const res = await handler.DELETE(req);
    expect(res.status).toBe(403);
  });
});

// ── /api/admin/data-retention ──
describe("POST /api/admin/data-retention", () => {
  let handler: typeof import("@/app/api/admin/data-retention/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/admin/data-retention/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/admin/data-retention", {
      method: "POST",
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE (requires admin)", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/admin/data-retention", {
      method: "POST",
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(403);
  });

  it("executes retention successfully for OWNER", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    // Mock all deleteMany to return { count: 0 }
    Object.values(mockPrisma).forEach((model) => {
      if (
        typeof model === "object" &&
        model !== null &&
        "deleteMany" in model
      ) {
        (model.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
          count: 0,
        });
      }
    });

    const req = new Request("http://localhost/api/admin/data-retention", {
      method: "POST",
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toBeDefined();
    expect(Array.isArray(body.results)).toBe(true);
  });
});
