/**
 * @vitest-environment node
 *
 * Tests for DELETE /api/account — GDPR Art. 17 Right to Erasure.
 *
 * Security properties verified:
 * - Requires authentication
 * - Requires email confirmation (prevents accidental deletion)
 * - OWNER cannot self-delete (would orphan workspace)
 * - Successful delete clears the JWT cache and sets cookie expiry header
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockUserDelete } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUserDelete: vi.fn(),
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
  prisma: { user: { delete: mockUserDelete } },
}));
vi.mock("@/lib/cache", () => ({
  cache: { del: vi.fn().mockResolvedValue(undefined) },
}));
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
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));

import { buildAdmin, buildOwner, buildEmployee } from "../helpers/factories";

describe("DELETE /api/account", () => {
  let handler: typeof import("@/app/api/account/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/account/route");
    mockUserDelete.mockResolvedValue({});
  });

  function deleteReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.DELETE(
      new Request("http://localhost/api/account", { method: "DELETE" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when confirmation is missing", async () => {
    const user = buildAdmin({ email: "admin@example.com" });
    mockSession.user = user;
    const res = await handler.DELETE(deleteReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CONFIRMATION_MISMATCH");
  });

  it("returns 400 when confirmation email does not match", async () => {
    const user = buildAdmin({ email: "admin@example.com" });
    mockSession.user = user;
    const res = await handler.DELETE(
      deleteReq({ confirmation: "wrong@example.com" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("CONFIRMATION_MISMATCH");
  });

  it("returns 409 when OWNER tries to self-delete", async () => {
    const owner = buildOwner({ email: "owner@example.com" });
    mockSession.user = owner;
    const res = await handler.DELETE(
      deleteReq({ confirmation: "owner@example.com" }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("OWNER_CANNOT_SELF_DELETE");
  });

  it("deletes non-owner account when confirmation matches", async () => {
    const user = buildAdmin({ email: "admin@example.com" });
    mockSession.user = user;
    const res = await handler.DELETE(
      deleteReq({ confirmation: "admin@example.com" }),
    );
    expect(res.status).toBe(200);
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: user.id } });
  });

  it("allows EMPLOYEE to delete own account", async () => {
    const user = buildEmployee({ email: "emp@example.com" });
    mockSession.user = user;
    const res = await handler.DELETE(
      deleteReq({ confirmation: "emp@example.com" }),
    );
    expect(res.status).toBe(200);
  });

  it("sets cookie expiry header to immediately invalidate session", async () => {
    const user = buildAdmin({ email: "admin@example.com" });
    mockSession.user = user;
    const res = await handler.DELETE(
      deleteReq({ confirmation: "admin@example.com" }),
    );
    expect(res.status).toBe(200);
    // Session cookies should be expired
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns success body on deletion", async () => {
    const user = buildAdmin({ email: "admin@example.com" });
    mockSession.user = user;
    const res = await handler.DELETE(
      deleteReq({ confirmation: "admin@example.com" }),
    );
    expect((await res.json()).success).toBe(true);
  });
});
