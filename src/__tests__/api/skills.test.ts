/**
 * @vitest-environment node
 *
 * Tests for Skills API:
 *   GET  /api/skills — list skills
 *   POST /api/skills — create skill
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockSkillFindMany, mockSkillCount, mockSkillCreate } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockSkillFindMany: vi.fn(),
    mockSkillCount: vi.fn(),
    mockSkillCreate: vi.fn(),
  }));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    skill: {
      findMany: mockSkillFindMany,
      count: mockSkillCount,
      create: mockSkillCreate,
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  },
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

import { buildAdmin, buildManager, buildEmployee } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/skills", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/skills", () => {
  let handler: typeof import("@/app/api/skills/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/skills/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/skills"));
    expect(res.status).toBe(401);
  });

  it("returns skills for admin", async () => {
    mockSession.user = buildAdmin();
    mockSkillFindMany.mockResolvedValue([
      { id: "s1", name: "Forklift", workspaceId: "ws-1" },
    ]);
    mockSkillCount.mockResolvedValue(1);

    const res = await handler.GET(new Request("http://localhost/api/skills"));
    expect(res.status).toBe(200);
  });

  it("returns 400 when user has no workspaceId", async () => {
    mockSession.user = buildAdmin({ workspaceId: "" as string });
    const res = await handler.GET(new Request("http://localhost/api/skills"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/skills", () => {
  let handler: typeof import("@/app/api/skills/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/skills/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(postReq({ name: "Driving" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(postReq({ name: "Driving" }));
    expect(res.status).toBe(403);
  });

  it("creates skill successfully", async () => {
    mockSession.user = buildAdmin();
    mockSkillCreate.mockResolvedValue({
      id: "s1",
      name: "Driving",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Driving" }));
    expect(res.status).toBe(201);
    expect(mockSkillCreate).toHaveBeenCalledOnce();
  });

  it("returns 409 for duplicate skill name (P2002)", async () => {
    mockSession.user = buildAdmin();
    const error = new Error("Unique constraint");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).code = "P2002";
    mockSkillCreate.mockRejectedValue(error);

    const res = await handler.POST(postReq({ name: "Duplicate" }));
    expect(res.status).toBe(409);
  });

  it("MANAGER can create skills", async () => {
    mockSession.user = buildManager();
    mockSkillCreate.mockResolvedValue({
      id: "s2",
      name: "Safety",
      workspaceId: "ws-1",
    });

    const res = await handler.POST(postReq({ name: "Safety" }));
    expect(res.status).toBe(201);
  });
});
