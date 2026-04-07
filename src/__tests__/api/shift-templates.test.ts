/**
 * @vitest-environment node
 *
 * Tests for Shift Templates API:
 *   GET  /api/shift-templates — list shift templates
 *   POST /api/shift-templates — create shift template
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockTemplateFindMany,
  mockTemplateCount,
  mockTemplateCreate,
  mockRequirePlanFeature,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockTemplateFindMany: vi.fn(),
  mockTemplateCount: vi.fn(),
  mockTemplateCreate: vi.fn(),
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
vi.mock("@/lib/db", () => ({
  prisma: {
    shiftTemplate: {
      findMany: mockTemplateFindMany,
      count: mockTemplateCount,
      create: mockTemplateCreate,
    },
  },
}));
vi.mock("@/lib/subscription", () => ({
  requirePlanFeature: mockRequirePlanFeature,
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
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

import { buildAdmin, buildEmployee, buildManager } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/shift-templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/shift-templates", () => {
  let handler: typeof import("@/app/api/shift-templates/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-templates/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/shift-templates"),
    );
    expect(res.status).toBe(401);
  });

  it("returns templates when EMPLOYEE has plan feature (no permission check on GET)", async () => {
    mockSession.user = buildEmployee();
    mockRequirePlanFeature.mockResolvedValue(null);
    mockTemplateFindMany.mockResolvedValue([]);
    mockTemplateCount.mockResolvedValue(0);
    const res = await handler.GET(
      new Request("http://localhost/api/shift-templates"),
    );
    expect(res.status).toBe(200);
  });

  it("returns templates for admin with plan feature", async () => {
    mockSession.user = buildAdmin();
    mockRequirePlanFeature.mockResolvedValue(null);
    mockTemplateFindMany.mockResolvedValue([
      { id: "t1", name: "Morning Shift", startTime: "06:00", endTime: "14:00" },
    ]);
    mockTemplateCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/shift-templates"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when plan does not support shift templates", async () => {
    mockSession.user = buildAdmin();
    const { NextResponse } = await import("next/server");
    mockRequirePlanFeature.mockResolvedValue(
      NextResponse.json(
        { error: "Plan does not support this feature" },
        { status: 403 },
      ),
    );

    const res = await handler.GET(
      new Request("http://localhost/api/shift-templates"),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/shift-templates", () => {
  let handler: typeof import("@/app/api/shift-templates/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/shift-templates/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      postReq({ name: "Morning", startTime: "06:00", endTime: "14:00" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(
      postReq({ name: "Morning", startTime: "06:00", endTime: "14:00" }),
    );
    expect(res.status).toBe(403);
  });

  it("creates template for admin", async () => {
    mockSession.user = buildAdmin();
    mockRequirePlanFeature.mockResolvedValue(null);
    mockTemplateCreate.mockResolvedValue({
      id: "t1",
      name: "Morning",
      startTime: "06:00",
      endTime: "14:00",
    });

    const res = await handler.POST(
      postReq({ name: "Morning", startTime: "06:00", endTime: "14:00" }),
    );
    expect(res.status).toBe(201);
  });

  it("MANAGER can create templates", async () => {
    mockSession.user = buildManager();
    mockRequirePlanFeature.mockResolvedValue(null);
    mockTemplateCreate.mockResolvedValue({
      id: "t2",
      name: "Evening",
      startTime: "14:00",
      endTime: "22:00",
    });

    const res = await handler.POST(
      postReq({ name: "Evening", startTime: "14:00", endTime: "22:00" }),
    );
    expect(res.status).toBe(201);
  });
});
