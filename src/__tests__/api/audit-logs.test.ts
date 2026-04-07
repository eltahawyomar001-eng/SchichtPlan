/**
 * @vitest-environment node
 *
 * Tests for Audit Logs API:
 *   GET /api/audit-logs — list audit logs (admin-only)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockAuditLogFindMany, mockAuditLogCount } = vi.hoisted(
  () => ({
    mockSession: { user: null as SessionUser | null },
    mockAuditLogFindMany: vi.fn(),
    mockAuditLogCount: vi.fn(),
  }),
);

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
    auditLog: {
      findMany: mockAuditLogFindMany,
      count: mockAuditLogCount,
    },
  },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdmin, buildManager, buildEmployee } from "../helpers/factories";

describe("GET /api/audit-logs", () => {
  let handler: typeof import("@/app/api/audit-logs/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/audit-logs/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/audit-logs"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to access", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.GET(
      new Request("http://localhost/api/audit-logs"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when MANAGER tries to access", async () => {
    mockSession.user = buildManager();
    const res = await handler.GET(
      new Request("http://localhost/api/audit-logs"),
    );
    expect(res.status).toBe(403);
  });

  it("returns audit logs for admin", async () => {
    mockSession.user = buildAdmin();
    mockAuditLogFindMany.mockResolvedValue([
      { id: "log1", action: "CREATE", entityType: "shift" },
    ]);
    mockAuditLogCount.mockResolvedValue(1);

    const res = await handler.GET(
      new Request("http://localhost/api/audit-logs"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("supports entityType filter", async () => {
    mockSession.user = buildAdmin();
    mockAuditLogFindMany.mockResolvedValue([]);
    mockAuditLogCount.mockResolvedValue(0);

    await handler.GET(
      new Request("http://localhost/api/audit-logs?entityType=shift"),
    );
    const call = mockAuditLogFindMany.mock.calls[0][0];
    expect(call.where.entityType).toBe("shift");
  });

  it("caps limit at 200", async () => {
    mockSession.user = buildAdmin();
    mockAuditLogFindMany.mockResolvedValue([]);
    mockAuditLogCount.mockResolvedValue(0);

    await handler.GET(new Request("http://localhost/api/audit-logs?limit=500"));
    const call = mockAuditLogFindMany.mock.calls[0][0];
    expect(call.take).toBe(200);
  });
});
