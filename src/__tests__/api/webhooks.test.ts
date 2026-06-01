/**
 * @vitest-environment node
 *
 * Tests for Webhooks API:
 *   GET  /api/webhooks — list webhook endpoints
 *   POST /api/webhooks — create webhook endpoint
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockWebhookFindMany,
  mockWebhookCount,
  mockWebhookCreate,
  mockSubscriptionFindUnique,
  mockUserFindUnique,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockWebhookFindMany: vi.fn(),
  mockWebhookCount: vi.fn(),
  mockWebhookCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
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
vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEndpoint: {
      findMany: mockWebhookFindMany,
      count: mockWebhookCount,
      create: mockWebhookCreate,
    },
    subscription: { findUnique: mockSubscriptionFindUnique },
    user: { findUnique: mockUserFindUnique },
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
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
vi.mock("@/lib/pagination", () => ({
  parsePagination: vi.fn().mockReturnValue({ take: 50, skip: 0 }),
  paginatedResponse: vi.fn(
    (items: unknown[], total: number, take: number, skip: number) => {
      const body = JSON.stringify({ data: items, total, take, skip });
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  ),
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

function postReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/webhooks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/webhooks", () => {
  let handler: typeof import("@/app/api/webhooks/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/webhooks/route");
    mockUserFindUnique.mockImplementation(() =>
      Promise.resolve(
        mockSession.user ? { workspaceId: mockSession.user.workspaceId } : null,
      ),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(new Request("http://localhost/api/webhooks"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to list", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.GET(new Request("http://localhost/api/webhooks"));
    expect(res.status).toBe(403);
  });

  it("returns webhooks for admin with plan feature", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "ENTERPRISE",
      status: "ACTIVE",
    });
    mockWebhookFindMany.mockResolvedValue([
      { id: "w1", url: "https://example.com/webhook" },
    ]);
    mockWebhookCount.mockResolvedValue(1);

    const res = await handler.GET(new Request("http://localhost/api/webhooks"));
    expect(res.status).toBe(200);
  });

  it("returns 403 when plan does not support webhooks", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const res = await handler.GET(new Request("http://localhost/api/webhooks"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/webhooks", () => {
  let handler: typeof import("@/app/api/webhooks/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/webhooks/route");
    mockUserFindUnique.mockImplementation(() =>
      Promise.resolve(
        mockSession.user ? { workspaceId: mockSession.user.workspaceId } : null,
      ),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      postReq({ url: "https://example.com", events: ["shift.created"] }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to create", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(
      postReq({ url: "https://example.com", events: ["shift.created"] }),
    );
    expect(res.status).toBe(403);
  });

  it("creates webhook successfully", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "ENTERPRISE",
      status: "ACTIVE",
    });
    mockWebhookCreate.mockResolvedValue({
      id: "w1",
      url: "https://example.com",
      events: ["shift.created"],
      secret: "abc123",
    });

    const res = await handler.POST(
      postReq({ url: "https://example.com", events: ["shift.created"] }),
    );
    expect(res.status).toBe(201);
  });
});
