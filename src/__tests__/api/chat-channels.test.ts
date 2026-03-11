/**
 * @vitest-environment node
 *
 * Tests for Chat Channels API:
 *   GET  /api/chat/channels — list channels
 *   POST /api/chat/channels — create channel
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockMemberFindMany,
  mockChannelCreate,
  mockRequirePlanFeature,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockMemberFindMany: vi.fn(),
  mockChannelCreate: vi.fn(),
  mockRequirePlanFeature: vi.fn(),
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
    chatChannelMember: {
      findMany: mockMemberFindMany,
    },
    chatChannel: {
      create: mockChannelCreate,
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  },
}));
vi.mock("@/lib/subscription", () => ({
  requirePlanFeature: mockRequirePlanFeature,
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin } from "../helpers/factories";

describe("GET /api/chat/channels", () => {
  let handler: typeof import("@/app/api/chat/channels/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/chat/channels/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when plan does not support team chat", async () => {
    const admin = buildAdmin();
    mockSession.user = admin;
    const { NextResponse } = await import("next/server");
    mockRequirePlanFeature.mockResolvedValue(
      NextResponse.json(
        { error: "Plan does not support this feature" },
        { status: 403 },
      ),
    );

    const res = await handler.GET();
    expect(res.status).toBe(403);
  });

  it("returns channels for user with plan feature", async () => {
    const admin = buildAdmin();
    mockSession.user = admin;
    mockRequirePlanFeature.mockResolvedValue(null);
    mockMemberFindMany.mockResolvedValue([
      {
        channel: {
          id: "ch1",
          name: "General",
          workspaceId: admin.workspaceId,
          _count: { members: 3, messages: 10 },
          members: [],
          messages: [],
        },
        lastReadAt: null,
      },
    ]);

    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("filters channels by workspaceId in the DB query", async () => {
    const admin = buildAdmin();
    mockSession.user = admin;
    mockRequirePlanFeature.mockResolvedValue(null);
    mockMemberFindMany.mockResolvedValue([]);

    await handler.GET();
    const call = mockMemberFindMany.mock.calls[0][0];
    // M2 fix: verify workspaceId is in the DB query, not JS filter
    expect(call.where.channel.workspaceId).toBe(admin.workspaceId);
  });
});

describe("POST /api/chat/channels", () => {
  let handler: typeof import("@/app/api/chat/channels/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/chat/channels/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      new Request("http://localhost/api/chat/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New Channel", type: "GROUP" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when plan does not support team chat", async () => {
    mockSession.user = buildAdmin();
    const { NextResponse } = await import("next/server");
    mockRequirePlanFeature.mockResolvedValue(
      NextResponse.json(
        { error: "Plan does not support this feature" },
        { status: 403 },
      ),
    );

    const res = await handler.POST(
      new Request("http://localhost/api/chat/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New Channel", type: "GROUP" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
