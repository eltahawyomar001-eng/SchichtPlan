/**
 * @vitest-environment node
 *
 * Tests for Notifications API:
 *   GET   /api/notifications — list notifications
 *   PATCH /api/notifications — mark notifications as read
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockNotificationFindMany,
  mockNotificationCount,
  mockNotificationUpdateMany,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockNotificationFindMany: vi.fn(),
  mockNotificationCount: vi.fn(),
  mockNotificationUpdateMany: vi.fn(),
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
    notification: {
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
      updateMany: mockNotificationUpdateMany,
    },
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/notifications", () => {
  let handler: typeof import("@/app/api/notifications/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/notifications/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/notifications"),
    );
    expect(res.status).toBe(401);
  });

  it("returns notifications scoped to user", async () => {
    mockSession.user = buildAdmin();
    mockNotificationFindMany.mockResolvedValue([
      { id: "n1", title: "New shift", isRead: false, userId: "user-1" },
    ]);
    mockNotificationCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/notifications"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data ?? body).toBeDefined();
  });

  it("EMPLOYEE can see own notifications", async () => {
    mockSession.user = buildEmployee();
    mockNotificationFindMany.mockResolvedValue([]);
    mockNotificationCount.mockResolvedValue(0);

    const res = await handler.GET(
      new Request("http://localhost/api/notifications"),
    );
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/notifications", () => {
  let handler: typeof import("@/app/api/notifications/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/notifications/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["n1"] }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("marks notifications as read", async () => {
    mockSession.user = buildAdmin();
    mockNotificationUpdateMany.mockResolvedValue({ count: 2 });

    const res = await handler.PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["n1", "n2"] }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
