/**
 * Tests for /api/automation-rules (GET, POST)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    automationRule: {
      findMany: vi.fn(),
      count: vi.fn(),
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
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn(() => ({ take: 50, skip: 0 })),
  paginatedResponse: vi.fn(
    async (data: unknown[], total: number, take: number, skip: number) => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({
        data,
        pagination: {
          total,
          limit: take,
          offset: skip,
          hasMore: total > skip + take,
        },
      });
    },
  ),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

describe("GET /api/automation-rules", () => {
  let handler: typeof import("@/app/api/automation-rules/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/automation-rules/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/automation-rules");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE without automations:read permission", async () => {
    mockSession.user = buildEmployee();
    const req = new Request("http://localhost/api/automation-rules");
    const res = await handler.GET(req);
    expect(res.status).toBe(403);
  });

  it("returns paginated rules with parsed JSON", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const rules = [
      {
        id: "r1",
        name: "Auto-approve",
        conditions: "[]",
        actions: '[{"type":"approve"}]',
      },
    ];
    mockPrisma.automationRule.findMany.mockResolvedValue(rules);
    mockPrisma.automationRule.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/automation-rules");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].actions).toEqual([{ type: "approve" }]);
  });
});

describe("POST /api/automation-rules", () => {
  let handler: typeof import("@/app/api/automation-rules/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/automation-rules/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/automation-rules", {
      method: "POST",
      body: JSON.stringify({
        name: "Rule 1",
        trigger: "shift_created",
        actions: [{ type: "notify" }],
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("creates rule with 201", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const created = { id: "r1", name: "Rule 1", trigger: "shift_created" };
    mockPrisma.automationRule.create.mockResolvedValue(created);

    const req = new Request("http://localhost/api/automation-rules", {
      method: "POST",
      body: JSON.stringify({
        name: "Rule 1",
        trigger: "shift_created",
        conditions: [],
        actions: [{ type: "notify" }],
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);
  });
});
