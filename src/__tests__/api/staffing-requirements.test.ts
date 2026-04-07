/**
 * Tests for /api/staffing-requirements (GET, POST)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    staffingRequirement: {
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
  },
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
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

describe("GET /api/staffing-requirements", () => {
  let handler: typeof import("@/app/api/staffing-requirements/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/staffing-requirements/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/staffing-requirements");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 when EMPLOYEE reads (has shifts:read)", async () => {
    mockSession.user = buildEmployee();
    mockPrisma.staffingRequirement.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/staffing-requirements");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
  });

  it("returns requirements scoped by workspaceId", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const requirements = [{ id: "r1", name: "Morning shift", weekday: 1 }];
    mockPrisma.staffingRequirement.findMany.mockResolvedValue(requirements);
    mockPrisma.staffingRequirement.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/staffing-requirements");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockPrisma.staffingRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: owner.workspaceId }),
      }),
    );
  });

  it("filters by locationId query param", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.staffingRequirement.findMany.mockResolvedValue([]);

    const req = new Request(
      "http://localhost/api/staffing-requirements?locationId=loc1",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.staffingRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ locationId: "loc1" }),
      }),
    );
  });
});

describe("POST /api/staffing-requirements", () => {
  let handler: typeof import("@/app/api/staffing-requirements/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/staffing-requirements/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/staffing-requirements", {
      method: "POST",
      body: JSON.stringify({
        name: "X",
        weekday: 0,
        startTime: "08:00",
        endTime: "16:00",
        minEmployees: 2,
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("creates requirement successfully", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const created = { id: "r1", name: "Morning", weekday: 1 };
    mockPrisma.staffingRequirement.create.mockResolvedValue(created);

    const req = new Request("http://localhost/api/staffing-requirements", {
      method: "POST",
      body: JSON.stringify({
        name: "Morning",
        weekday: 1,
        startTime: "06:00",
        endTime: "14:00",
        minEmployees: 3,
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);
  });
});
