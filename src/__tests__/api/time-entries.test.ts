/**
 * @vitest-environment node
 *
 * Tests for Time Entries API:
 *   GET  /api/time-entries — list time entries
 *   POST /api/time-entries — create time entry
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockTimeEntryFindMany,
  mockTimeEntryCount,
  mockTimeEntryCreate,
  mockEmployeeFindFirst,
  mockTransaction,
} = vi.hoisted(() => {
  const mockTimeEntryCreate = vi.fn();
  const mockTx = {
    timeEntry: { create: mockTimeEntryCreate },
    timeEntryAudit: { create: vi.fn().mockResolvedValue({ id: "aud1" }) },
  };
  return {
    mockSession: { user: null as SessionUser | null },
    mockTimeEntryFindMany: vi.fn(),
    mockTimeEntryCount: vi.fn(),
    mockTimeEntryCreate,
    mockEmployeeFindFirst: vi.fn(),
    mockTransaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx),
    ),
  };
});

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    timeEntry: {
      findMany: mockTimeEntryFindMany,
      count: mockTimeEntryCount,
      create: mockTimeEntryCreate,
      aggregate: vi.fn().mockResolvedValue({ _sum: { netMinutes: 0 } }),
    },
    employee: {
      findFirst: mockEmployeeFindFirst,
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
    $transaction: mockTransaction,
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
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/automations", () => ({
  ensureLegalBreak: vi.fn().mockReturnValue(30),
}));
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
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
vi.mock("@/lib/time-utils", () => ({
  validateTimeEntry: vi.fn().mockReturnValue([]),
  calcGrossMinutes: vi.fn().mockReturnValue(480),
  calcBreakMinutes: vi.fn().mockReturnValue(30),
  calcNetMinutes: vi.fn().mockReturnValue(450),
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/time-entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validEntry = {
  date: "2025-03-10",
  startTime: "08:00",
  endTime: "16:00",
  employeeId: "emp-1",
};

describe("GET /api/time-entries", () => {
  let handler: typeof import("@/app/api/time-entries/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/time-entries/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/time-entries"),
    );
    expect(res.status).toBe(401);
  });

  it("returns time entries for admin", async () => {
    mockSession.user = buildAdmin();
    mockTimeEntryFindMany.mockResolvedValue([
      { id: "te1", date: "2025-03-10" },
    ]);
    mockTimeEntryCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/time-entries"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("EMPLOYEE scoped to own entries via email lookup", async () => {
    const emp = buildEmployee({ employeeId: "emp-1" });
    mockSession.user = emp;
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp-1" });
    mockTimeEntryFindMany.mockResolvedValue([]);
    mockTimeEntryCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/time-entries"));
    expect(mockEmployeeFindFirst).toHaveBeenCalled();
  });

  it("supports date range filters", async () => {
    mockSession.user = buildAdmin();
    mockTimeEntryFindMany.mockResolvedValue([]);
    mockTimeEntryCount.mockResolvedValue(0);

    await handler.GET(
      new Request(
        "http://localhost/api/time-entries?start=2025-03-01&end=2025-03-31",
      ),
    );
    const call = mockTimeEntryFindMany.mock.calls[0][0];
    expect(call.where.date).toBeDefined();
  });
});

describe("POST /api/time-entries", () => {
  let handler: typeof import("@/app/api/time-entries/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTimeEntryFindMany.mockResolvedValue([]); // no overlap
    handler = await import("@/app/api/time-entries/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq(validEntry));
    expect(res.status).toBe(401);
  });

  it("EMPLOYEE can only create for self (returns 403 for other)", async () => {
    mockSession.user = buildEmployee({ employeeId: "emp-1" });
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp-1" });

    // Try creating for a different employee
    const res = await handler.POST(
      postReq({ ...validEntry, employeeId: "emp-other" }),
    );
    expect(res.status).toBe(403);
  });

  it("creates time entry successfully for admin", async () => {
    mockSession.user = buildAdmin();
    mockTimeEntryCreate.mockResolvedValue({
      id: "te1",
      ...validEntry,
      status: "ENTWURF",
      employee: { id: "emp-1", firstName: "Max", lastName: "M" },
      location: null,
    });

    const res = await handler.POST(postReq(validEntry));
    expect(res.status).toBe(201);
    expect(mockTimeEntryCreate).toHaveBeenCalledOnce();
  });
});
