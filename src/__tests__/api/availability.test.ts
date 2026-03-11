/**
 * @vitest-environment node
 *
 * Tests for Availability API:
 *   GET  /api/availability — list availability
 *   POST /api/availability — batch create availability
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockAvailabilityFindMany,
  mockAvailabilityDeleteMany,
  mockAvailabilityCreateMany,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockAvailabilityFindMany: vi.fn(),
  mockAvailabilityDeleteMany: vi.fn(),
  mockAvailabilityCreateMany: vi.fn(),
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
    availability: {
      findMany: mockAvailabilityFindMany,
      count: vi.fn().mockResolvedValue(0),
      deleteMany: mockAvailabilityDeleteMany,
      createMany: mockAvailabilityCreateMany,
    },
    employee: {
      findFirst: vi.fn().mockResolvedValue({ id: "emp-1" }),
    },
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
      return NextResponse.json({
        data: items,
        pagination: { total, limit: take, offset: skip },
      });
    },
  ),
}));

import { buildAdmin, buildEmployee } from "../helpers/factories";

describe("GET /api/availability", () => {
  let handler: typeof import("@/app/api/availability/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/availability/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/availability"),
    );
    expect(res.status).toBe(401);
  });

  it("returns availability for admin", async () => {
    mockSession.user = buildAdmin();
    mockAvailabilityFindMany.mockResolvedValue([
      { id: "av1", weekday: 1, startTime: "08:00", endTime: "16:00" },
    ]);

    const res = await handler.GET(
      new Request("http://localhost/api/availability?employeeId=emp-1"),
    );
    expect(res.status).toBe(200);
  });

  it("EMPLOYEE can also read availability (has read permission)", async () => {
    mockSession.user = buildEmployee({ employeeId: "emp-1" });
    mockAvailabilityFindMany.mockResolvedValue([]);

    const res = await handler.GET(
      new Request("http://localhost/api/availability"),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/availability", () => {
  let handler: typeof import("@/app/api/availability/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/availability/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      new Request("http://localhost/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-1",
          entries: [
            {
              weekday: 1,
              startTime: "08:00",
              endTime: "16:00",
              type: "VERFUEGBAR",
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("EMPLOYEE cannot set availability for another employee", async () => {
    mockSession.user = buildEmployee({ employeeId: "emp-1" });
    const res = await handler.POST(
      new Request("http://localhost/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-other",
          entries: [
            {
              weekday: 1,
              startTime: "08:00",
              endTime: "16:00",
              type: "VERFUEGBAR",
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("creates availability for admin", async () => {
    mockSession.user = buildAdmin();
    mockAvailabilityDeleteMany.mockResolvedValue({ count: 0 });
    mockAvailabilityCreateMany.mockResolvedValue({ count: 1 });

    const res = await handler.POST(
      new Request("http://localhost/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-1",
          entries: [
            {
              weekday: 1,
              startTime: "08:00",
              endTime: "16:00",
              type: "VERFUEGBAR",
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(201);
  });
});
