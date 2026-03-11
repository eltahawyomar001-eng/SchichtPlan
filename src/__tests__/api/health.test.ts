/**
 * @vitest-environment node
 *
 * Tests for Health API:
 *   GET /api/health — health check endpoint
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("GET /api/health", () => {
  let handler: typeof import("@/app/api/health/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear env vars that health check uses
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    handler = await import("@/app/api/health/route");
  });

  it("returns 200 when database is reachable", async () => {
    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
  });

  it("returns 503 when database is unreachable", async () => {
    const { prisma } = await import("@/lib/db");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.$queryRaw as any).mockRejectedValueOnce(
      new Error("Connection failed"),
    );

    const res = await handler.GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
  });
});
