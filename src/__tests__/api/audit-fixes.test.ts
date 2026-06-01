/**
 * @vitest-environment node
 *
 * Tests for audit-fix changes:
 * - Permission keys (clients, reports, datev)
 * - Plan gates (shift-templates, import)
 * - MiLoG minimum wage warning
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Shared mock state ── */
const {
  mockSession,
  mockSubscriptionFindUnique,
  mockClientFindFirst,
  mockClientUpdate,
  mockClientDelete,
  mockShiftTemplateFindMany,
  mockShiftTemplateCount,
  mockEmployeeCreate,
  mockEmployeeCount,
  mockEmployeeUpdateMany,
  mockUsageFindUnique,
  mockInvitationCount,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockSubscriptionFindUnique: vi.fn(),
  mockClientFindFirst: vi.fn(),
  mockClientUpdate: vi.fn(),
  mockClientDelete: vi.fn(),
  mockShiftTemplateFindMany: vi.fn(),
  mockShiftTemplateCount: vi.fn(),
  mockEmployeeCreate: vi.fn(),
  mockEmployeeCount: vi.fn(),
  mockEmployeeUpdateMany: vi.fn(),
  mockUsageFindUnique: vi.fn(),
  mockInvitationCount: vi.fn(),
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
      if (!mockSession.user.workspaceId) {
        const { NextResponse } = await import("next/server");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "No workspace" },
            { status: 400 },
          ),
        };
      }
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId as string,
      };
    }),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    employee: {
      count: mockEmployeeCount,
      create: mockEmployeeCreate,
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: mockEmployeeUpdateMany,
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    invitation: {
      count: mockInvitationCount,
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "inv-1" }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue({ id: "ws-1", name: "Test WS" }),
    },
    workspaceUsage: {
      findUnique: mockUsageFindUnique,
      create: vi
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "usage-1", ...args.data }),
        ),
    },
    client: {
      findFirst: mockClientFindFirst,
      update: mockClientUpdate,
      delete: mockClientDelete,
    },
    shiftTemplate: {
      findMany: mockShiftTemplateFindMany,
      count: mockShiftTemplateCount,
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

vi.mock("@/lib/automations", () => ({
  executeCustomRules: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogTx: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/employee-pin", () => ({
  generateUniquePin: vi.fn().mockResolvedValue("1234"),
  hashPin: vi.fn().mockReturnValue("hashed-pin"),
  sendPinEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/billing-seats", () => ({
  reconcileSeatsFromEmployees: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/i18n/locale", () => ({
  getLocaleFromCookie: vi.fn().mockResolvedValue("de"),
}));

vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  invitationEmail: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/notifications/email-i18n", () => ({
  invitationEmail: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn().mockResolvedValue(null),
  cacheIdempotentResponse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withRequestId: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { buildOwner, buildEmployee, buildManager } from "../helpers/factories";

/* ═══════════════════════════════════════════════════════════════
   Clients API — Permission Key Fix
   ═══════════════════════════════════════════════════════════════ */

describe("PATCH /api/clients/[id] — uses 'clients' permission", () => {
  let handler: typeof import("@/app/api/clients/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/clients/[id]/route");
  });

  it("returns 403 when EMPLOYEE tries to update client", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/clients/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows MANAGER to update client", async () => {
    mockSession.user = buildManager();
    mockClientFindFirst.mockResolvedValue({
      id: "c1",
      name: "Old Name",
      workspaceId: mockSession.user.workspaceId,
    });
    mockClientUpdate.mockResolvedValue({
      id: "c1",
      name: "Updated",
    });

    const req = new Request("http://localhost/api/clients/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await handler.PATCH(req, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/clients/[id] — uses 'clients' permission", () => {
  let handler: typeof import("@/app/api/clients/[id]/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/clients/[id]/route");
  });

  it("returns 403 when EMPLOYEE tries to delete client", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/clients/c1", {
      method: "DELETE",
    });
    const res = await handler.DELETE(req, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Shift Templates — Plan Gate
   ═══════════════════════════════════════════════════════════════ */

describe("GET /api/shift-templates — plan gate", () => {
  let handler: typeof import("@/app/api/shift-templates/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-templates/route");
  });

  it("allows BASIC plan to access shift templates", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    // Basic plan — shiftTemplates included
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "BASIC",
      status: "ACTIVE",
      workspaceId: owner.workspaceId,
    });
    mockShiftTemplateFindMany.mockResolvedValue([]);
    mockShiftTemplateCount.mockResolvedValue(0);

    const res = await handler.GET(
      new Request("http://localhost/api/shift-templates"),
    );
    expect(res.status).toBe(200);
  });

  it("allows PROFESSIONAL plan to access shift templates", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      workspaceId: owner.workspaceId,
    });
    mockShiftTemplateFindMany.mockResolvedValue([]);
    mockShiftTemplateCount.mockResolvedValue(0);

    const res = await handler.GET(
      new Request("http://localhost/api/shift-templates"),
    );
    expect(res.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Employees — MiLoG Minimum Wage Warning
   ═══════════════════════════════════════════════════════════════ */

describe("POST /api/employees — MiLoG warning", () => {
  let handler: typeof import("@/app/api/employees/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/employees/route");
  });

  it("blocks creation when hourlyRate is below minimum wage (MiLoG hard block)", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    // requireUserSlot needs subscription + usage data to proceed
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      workspaceId: owner.workspaceId,
    });
    mockUsageFindUnique.mockResolvedValue({
      id: "usage-1",
      workspaceId: owner.workspaceId,
      userSlotsTotal: 100,
      pdfsGeneratedThisMonth: 0,
      pdfsMonthlyLimit: 500,
      pdfsResetAt: new Date(),
      storageBytesUsed: BigInt(0),
      storageBytesLimit: BigInt(5368709120),
    });
    mockEmployeeCount.mockResolvedValue(1);
    mockInvitationCount.mockResolvedValue(0);

    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Max",
        lastName: "Mustermann",
        email: "max@example.com",
        hourlyRate: 10.5, // below MILOG_MIN_WAGE (13.9)
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toBe("MILOG_VIOLATION");
    expect(body.message).toContain("MiLoG");
    expect(body.milogMinWage).toBe(13.9);
  });

  it("does not return warning when hourlyRate is above minimum wage", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      workspaceId: owner.workspaceId,
    });
    mockEmployeeCount.mockResolvedValue(1);
    mockInvitationCount.mockResolvedValue(0);
    mockUsageFindUnique.mockResolvedValue({
      id: "usage-1",
      workspaceId: owner.workspaceId,
      userSlotsTotal: 100,
      pdfsGeneratedThisMonth: 0,
      pdfsMonthlyLimit: 500,
      pdfsResetAt: new Date(),
      storageBytesUsed: BigInt(0),
      storageBytesLimit: BigInt(5368709120),
    });

    const createdEmployee = {
      id: "emp2",
      firstName: "Erika",
      lastName: "Musterfrau",
      hourlyRate: 15.0,
      workspaceId: owner.workspaceId,
    };
    mockEmployeeCreate.mockResolvedValue(createdEmployee);

    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Erika",
        lastName: "Musterfrau",
        email: "erika@example.com",
        hourlyRate: 15.0,
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.warnings).toBeUndefined();
  });
});
