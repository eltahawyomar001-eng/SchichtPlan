/**
 * @vitest-environment node
 *
 * Tests for Profile API:
 *   DELETE /api/profile — delete account (Art. 17 DSGVO)
 *   PATCH  /api/profile — update profile
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockUserFindUnique, mockUserDelete, mockUserUpdate } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockUserFindUnique: vi.fn(),
    mockUserDelete: vi.fn(),
    mockUserUpdate: vi.fn(),
  }));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => {
  const tx = {
    user: {
      findUnique: mockUserFindUnique,
      delete: mockUserDelete,
      update: mockUserUpdate,
    },
    workspace: { delete: vi.fn().mockResolvedValue(undefined) },
    notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    notificationPreference: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    account: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    prisma: {
      ...tx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn((cb: (t: any) => Promise<any>) => cb(tx)),
    },
  };
});
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("hashed"),
  },
}));

import { buildOwner, buildAdmin } from "../helpers/factories";

describe("DELETE /api/profile", () => {
  let handler: typeof import("@/app/api/profile/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/profile/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    mockSession.user = buildAdmin();
    mockUserFindUnique.mockResolvedValue(null);

    const res = await handler.DELETE();
    expect(res.status).toBe(404);
  });

  it("deletes account for non-owner member", async () => {
    mockSession.user = buildAdmin();
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      workspaceId: "ws-1",
      workspace: null,
    });
    mockUserDelete.mockResolvedValue({ id: "user-1" });

    const res = await handler.DELETE();
    expect(res.status).toBe(200);
  });

  it("returns 409 when OWNER tries to delete with other members", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      role: "OWNER",
      workspaceId: "ws-1",
      workspace: {
        members: [{ id: "user-1" }, { id: "user-2" }],
      },
    });

    const res = await handler.DELETE();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("OWNER_TRANSFER_REQUIRED");
  });
});

describe("PATCH /api/profile", () => {
  let handler: typeof import("@/app/api/profile/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/profile/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("updates profile name", async () => {
    mockSession.user = buildAdmin();
    mockUserUpdate.mockResolvedValue({
      id: "user-1",
      name: "New Name",
      email: "test@test.com",
    });

    const res = await handler.PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
