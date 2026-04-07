/**
 * Tests for /api/push-subscriptions (POST, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
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

import { buildOwner } from "../helpers/factories";

describe("POST /api/push-subscriptions", () => {
  let handler: typeof import("@/app/api/push-subscriptions/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/push-subscriptions/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/push-subscriptions", {
      method: "POST",
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/...",
        keys: { p256dh: "abc", auth: "def" },
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("creates push subscription with 201", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const sub = {
      id: "ps1",
      endpoint: "https://push.example.com",
      userId: owner.id,
    };
    mockPrisma.pushSubscription.upsert.mockResolvedValue(sub);

    const req = new Request("http://localhost/api/push-subscriptions", {
      method: "POST",
      body: JSON.stringify({
        endpoint: "https://push.example.com",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/push-subscriptions", () => {
  let handler: typeof import("@/app/api/push-subscriptions/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/push-subscriptions/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/push-subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: "https://push.example.com" }),
    });
    const res = await handler.DELETE(req);
    expect(res.status).toBe(401);
  });

  it("deletes subscription scoped by userId", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

    const req = new Request("http://localhost/api/push-subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: "https://push.example.com" }),
    });
    const res = await handler.DELETE(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: owner.id, endpoint: "https://push.example.com" },
    });
  });
});
