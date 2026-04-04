/**
 * Tests for /api/export/datev (GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    timeEntry: { findMany: vi.fn() },
    employee: { findUnique: vi.fn() },
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
vi.mock("@/lib/subscription", () => ({
  requirePlanFeature: vi.fn(() => null),
}));
vi.mock("@/lib/subscription-guard", () => ({
  requirePdfQuota: vi.fn(() => null),
  recordPdfGeneration: vi.fn(),
}));
vi.mock("@/lib/time-utils", () => ({
  toIndustrialHours: vi.fn(() => 8.0),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

describe("GET /api/export/datev", () => {
  let handler: typeof import("@/app/api/export/datev/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/export/datev/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request(
      "http://localhost/api/export/datev?start=2025-01-01&end=2025-01-31",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE without payroll-export:read", async () => {
    mockSession.user = buildEmployee();
    const req = new Request(
      "http://localhost/api/export/datev?start=2025-01-01&end=2025-01-31",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when start/end dates are missing", async () => {
    mockSession.user = buildOwner();
    const req = new Request("http://localhost/api/export/datev");
    const res = await handler.GET(req);
    expect(res.status).toBe(400);
  });

  it("returns CSV response for valid date range", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.timeEntry.findMany.mockResolvedValue([
      {
        id: "te1",
        date: new Date("2025-01-15"),
        startTime: "08:00",
        endTime: "16:00",
        breakMinutes: 30,
        grossMinutes: 480,
        netMinutes: 450,
        status: "BESTAETIGT",
        employee: {
          id: "e1",
          firstName: "Max",
          lastName: "Mustermann",
          position: "Dev",
        },
        location: { name: "Berlin" },
      },
    ]);

    const req = new Request(
      "http://localhost/api/export/datev?start=2025-01-01&end=2025-01-31",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const disposition = res.headers.get("content-disposition") || "";
    expect(disposition).toContain("lohnexport-Alle-");

    const csv = await res.text();
    expect(csv).toContain("Mustermann");
    expect(csv).toContain("Max");
    expect(csv).toContain("Status");
  });

  it("includes employee name in filename when employeeId is provided", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.timeEntry.findMany.mockResolvedValue([
      {
        id: "te1",
        date: new Date("2025-01-15"),
        startTime: "08:00",
        endTime: "16:00",
        breakMinutes: 30,
        grossMinutes: 480,
        netMinutes: 450,
        status: "BESTAETIGT",
        employee: {
          id: "e1",
          firstName: "Max",
          lastName: "Mustermann",
          position: "Dev",
        },
        location: { name: "Berlin" },
      },
    ]);

    const req = new Request(
      "http://localhost/api/export/datev?start=2025-01-01&end=2025-01-31&employeeId=e1",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const disposition = res.headers.get("content-disposition") || "";
    expect(disposition).toContain("Mustermann-Max");
  });

  it("returns JSON when format=json", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.timeEntry.findMany.mockResolvedValue([]);

    const req = new Request(
      "http://localhost/api/export/datev?start=2025-01-01&end=2025-01-31&format=json",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
