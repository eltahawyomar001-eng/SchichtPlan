/**
 * @vitest-environment node
 *
 * Tests for GET /api/cron/cleanup-tokens
 *
 * Deletes expired PasswordResetTokens. Cron secret auth.
 * Returns { resetTokensDeleted }.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDeleteMany } = vi.hoisted(() => ({
  mockDeleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    passwordResetToken: { deleteMany: mockDeleteMany },
  },
}));
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
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

const CRON = "cleanup-cron";

function makeReq(secret?: string) {
  return new Request("http://localhost/api/cron/cleanup-tokens", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/cleanup-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON);
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("returns 401 when cron secret is missing", async () => {
    const { GET } = await import("@/app/api/cron/cleanup-tokens/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/cron/cleanup-tokens/route");
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns zero count when no tokens are expired", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });
    const { GET } = await import("@/app/api/cron/cleanup-tokens/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resetTokensDeleted).toBe(0);
    expect(mockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expires: expect.any(Object) }),
      }),
    );
  });

  it("returns deleted count when expired tokens exist", async () => {
    mockDeleteMany.mockResolvedValue({ count: 7 });
    const { GET } = await import("@/app/api/cron/cleanup-tokens/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resetTokensDeleted).toBe(7);
  });
});
