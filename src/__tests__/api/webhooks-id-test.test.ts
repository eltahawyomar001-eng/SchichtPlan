/**
 * @vitest-environment node
 *
 * Tests for POST /api/webhooks/[id]/test
 *
 * Sends a signed test ping to the webhook URL.
 * Only OWNER/ADMIN (webhooks:update permission) can trigger.
 * Always returns 200; the body indicates whether delivery succeeded.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindFirst, mockFetch } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindFirst: vi.fn(),
  mockFetch: vi.fn(),
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
  prisma: { webhookEndpoint: { findFirst: mockFindFirst } },
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
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    withRequestId: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

// Override global fetch
vi.stubGlobal("fetch", mockFetch);

const owner: SessionUser = {
  id: "u1",
  email: "owner@test.com",
  workspaceId: "ws1",
  role: "OWNER",
  employeeId: null,
  name: "Owner",
};
const manager: SessionUser = { ...owner, id: "u2", role: "MANAGER" };

const hook = {
  id: "wh1",
  workspaceId: "ws1",
  url: "https://example.com/hook",
  secret: "s3cr3t",
  events: ["test"],
};

const makeCtx = (id = "wh1") => ({ params: Promise.resolve({ id }) });
const postReq = () =>
  new Request("http://localhost/api/webhooks/wh1/test", { method: "POST" });

describe("POST /api/webhooks/[id]/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when MANAGER calls (webhooks:update is OWNER/ADMIN only)", async () => {
    mockSession.user = manager;
    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when webhook not found", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns ok:true when delivery succeeds", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(hook);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe(200);
  });

  it("returns ok:false when remote returns non-2xx", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(hook);
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.status).toBe(500);
    expect(body.error).toMatch(/500/);
  });

  it("returns ok:false when delivery throws (network error)", async () => {
    mockSession.user = owner;
    mockFindFirst.mockResolvedValue(hook);
    mockFetch.mockRejectedValue(new Error("Connection refused"));
    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const res = await POST(postReq(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Connection refused/);
  });
});
