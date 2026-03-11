/**
 * Tests for /api/notification-preferences (GET, PUT)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    user: { findUnique: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
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

import { buildOwner } from "../helpers/factories";

describe("GET /api/notification-preferences", () => {
  let handler: typeof import("@/app/api/notification-preferences/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/notification-preferences/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns emailEnabled true by default when no preference exists", async () => {
    mockSession.user = buildOwner({ email: "user@test.com" });
    mockPrisma.user.findUnique.mockResolvedValue({
      notificationPreferences: [],
    });

    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailEnabled).toBe(true);
  });

  it("returns stored preference value", async () => {
    mockSession.user = buildOwner({ email: "user@test.com" });
    mockPrisma.user.findUnique.mockResolvedValue({
      notificationPreferences: [{ enabled: false }],
    });

    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailEnabled).toBe(false);
  });
});

describe("PUT /api/notification-preferences", () => {
  let handler: typeof import("@/app/api/notification-preferences/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/notification-preferences/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/notification-preferences", {
      method: "PUT",
      body: JSON.stringify({ emailEnabled: false }),
    });
    const res = await handler.PUT(req);
    expect(res.status).toBe(401);
  });

  it("upserts preference successfully", async () => {
    mockSession.user = buildOwner({ email: "user@test.com" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
    mockPrisma.notificationPreference.upsert.mockResolvedValue({
      enabled: false,
    });

    const req = new Request("http://localhost/api/notification-preferences", {
      method: "PUT",
      body: JSON.stringify({ emailEnabled: false }),
    });
    const res = await handler.PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailEnabled).toBe(false);
  });
});
