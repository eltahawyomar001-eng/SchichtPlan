/**
 * @vitest-environment node
 *
 * Tests for GET /api/cron/retry-emails
 *
 * Retries PENDING EmailJobs whose back-off window has elapsed.
 * Returns { processed, delivered, permanentlyFailed }.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockUpdate, mockSendEmail } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emailJob: { findMany: mockFindMany, update: mockUpdate },
  },
}));
vi.mock("@/lib/notifications/email", () => ({ sendEmail: mockSendEmail }));
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

const CRON = "email-cron";

function makeReq(secret?: string) {
  return new Request("http://localhost/api/cron/retry-emails", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const pendingJob = {
  id: "ej1",
  to: "user@test.com",
  type: "NOTIFICATION",
  category: "transactional",
  title: "Alert",
  message: "Hello",
  link: null,
  locale: "de",
  attempts: 0,
  maxAttempts: 3,
  status: "PENDING",
  nextRetryAt: null,
};

describe("GET /api/cron/retry-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", CRON);
    mockFindMany.mockResolvedValue([]);
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it("returns 401 when cron secret is missing", async () => {
    const { GET } = await import("@/app/api/cron/retry-emails/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when cron secret is wrong", async () => {
    const { GET } = await import("@/app/api/cron/retry-emails/route");
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns zero counts when no jobs are retryable", async () => {
    mockFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/cron/retry-emails/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.delivered).toBe(0);
    expect(body.permanentlyFailed).toBe(0);
  });

  it("delivers pending jobs and returns processed count", async () => {
    mockFindMany.mockResolvedValue([pendingJob]);
    mockSendEmail.mockResolvedValue({ success: true });
    const { GET } = await import("@/app/api/cron/retry-emails/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.delivered).toBe(1);
    expect(body.permanentlyFailed).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("marks job as permanently failed when maxAttempts reached", async () => {
    const exhaustedJob = { ...pendingJob, attempts: 2, maxAttempts: 3 }; // next attempt (3) = maxAttempts
    mockFindMany.mockResolvedValue([exhaustedJob]);
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP timeout" });
    const { GET } = await import("@/app/api/cron/retry-emails/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.permanentlyFailed).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("skips jobs whose attempts have already reached maxAttempts", async () => {
    const maxedJob = { ...pendingJob, attempts: 3, maxAttempts: 3 }; // already maxed
    mockFindMany.mockResolvedValue([maxedJob]);
    const { GET } = await import("@/app/api/cron/retry-emails/route");
    const res = await GET(makeReq(CRON));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
