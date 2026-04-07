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
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    subscription: { findUnique: mockSubscriptionFindUnique },
    employee: {
      count: mockEmployeeCount,
      create: mockEmployeeCreate,
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: mockEmployeeUpdateMany,
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    invitation: { count: mockInvitationCount },
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

  it("returns warning when hourlyRate is below minimum wage", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    // PROFESSIONAL plan — no employee limit issues
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
      id: "emp1",
      firstName: "Max",
      lastName: "Mustermann",
      hourlyRate: 10.5,
      workspaceId: owner.workspaceId,
    };
    mockEmployeeCreate.mockResolvedValue(createdEmployee);

    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Max",
        lastName: "Mustermann",
        hourlyRate: 10.5,
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.warnings).toBeDefined();
    expect(body.warnings[0]).toContain("Mindestlohn");
    expect(body.warnings[0]).toContain("MiLoG");
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
        hourlyRate: 15.0,
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.warnings).toBeUndefined();
  });
});
