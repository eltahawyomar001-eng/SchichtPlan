/**
 * @vitest-environment node
 *
 * Tests for Import API:
 *   POST /api/import — import employees/shifts from CSV/Excel
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockSubscriptionFindUnique } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockSubscriptionFindUnique: vi.fn(),
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
    subscription: { findUnique: mockSubscriptionFindUnique },
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn((cb: any) =>
      cb({
        employee: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        shift: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    ),
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("POST /api/import", () => {
  let handler: typeof import("@/app/api/import/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/import/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const formData = new FormData();
    formData.append("type", "employees");
    const res = await handler.POST(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: formData,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to import", async () => {
    mockSession.user = buildEmployee();
    const formData = new FormData();
    formData.append("type", "employees");
    const res = await handler.POST(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: formData,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when no file is provided", async () => {
    mockSession.user = buildAdmin();
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    });
    const formData = new FormData();
    formData.append("type", "employees");
    const res = await handler.POST(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: formData,
      }),
    );
    expect(res.status).toBe(400);
  });
});
