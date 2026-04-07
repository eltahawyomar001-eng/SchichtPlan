/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/* ── Mocks ──────────────────────────────────────────────────── */

const mockCaptureRouteError = vi.fn();
const mockLogError = vi.fn();
const mockLogWarn = vi.fn();
const mockCheckIdempotency = vi.fn().mockResolvedValue(null);
const mockCacheIdempotentResponse = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/sentry", () => ({
  captureRouteError: (...args: unknown[]) => mockCaptureRouteError(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
}));

vi.mock("@/lib/api-response", () => ({
  serverError: (msg?: string) =>
    NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 },
    ),
}));

vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: (...args: unknown[]) => mockCheckIdempotency(...args),
  cacheIdempotentResponse: (...args: unknown[]) =>
    mockCacheIdempotentResponse(...args),
}));

/* ── Import after mocks ─────────────────────────────────────── */

import { withRoute } from "@/lib/with-route";

/* ── Helpers ────────────────────────────────────────────────── */

function makeReq(url = "http://localhost/api/test", method = "GET") {
  return new NextRequest(url, { method });
}

/* ── Tests ──────────────────────────────────────────────────── */

describe("withRoute()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the request through to the handler and returns its response", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ data: "ok" }, { status: 200 }));

    const wrapped = withRoute("/api/test", "GET", handler);
    const res = await wrapped(makeReq());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: "ok" });
  });

  it("catches thrown errors and returns 500", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("boom"));

    const wrapped = withRoute("/api/test", "POST", handler);
    const res = await wrapped(makeReq("http://localhost/api/test", "POST"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("calls captureRouteError on thrown errors", async () => {
    const err = new Error("boom");
    const handler = vi.fn().mockRejectedValue(err);

    const wrapped = withRoute("/api/test", "POST", handler);
    await wrapped(makeReq("http://localhost/api/test", "POST"));

    expect(mockCaptureRouteError).toHaveBeenCalledWith(err, {
      route: "/api/test",
      method: "POST",
    });
  });

  it("calls log.error on thrown errors", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("db down"));

    const wrapped = withRoute("/api/db", "GET", handler);
    await wrapped(makeReq());

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError.mock.calls[0][0]).toContain("/api/db GET failed");
  });

  it("logs a warning for slow routes (>5s)", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      // Simulate a slow route by mocking Date.now
      return NextResponse.json({ data: "slow" });
    });

    // Mock Date.now to simulate slow execution
    const originalNow = Date.now;
    let callCount = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      callCount++;
      // First call (start) returns 0, subsequent calls return 6000 (>5s threshold)
      return callCount === 1 ? 0 : 6000;
    });

    const wrapped = withRoute("/api/slow", "GET", handler);
    await wrapped(makeReq());

    expect(mockLogWarn).toHaveBeenCalledTimes(1);
    expect(mockLogWarn.mock.calls[0][0]).toContain("Slow route");

    Date.now = originalNow;
    vi.restoreAllMocks();
  });

  it("checks idempotency when options.idempotent is true for POST", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(
        NextResponse.json({ data: "created" }, { status: 201 }),
      );

    const wrapped = withRoute("/api/test", "POST", handler, {
      idempotent: true,
    });
    await wrapped(makeReq("http://localhost/api/test", "POST"));

    expect(mockCheckIdempotency).toHaveBeenCalledTimes(1);
    expect(mockCacheIdempotentResponse).toHaveBeenCalledTimes(1);
  });

  it("returns cached response when idempotency key matches", async () => {
    const cachedResponse = NextResponse.json(
      { data: "cached" },
      { status: 201 },
    );
    mockCheckIdempotency.mockResolvedValueOnce(cachedResponse);

    const handler = vi.fn();
    const wrapped = withRoute("/api/test", "POST", handler, {
      idempotent: true,
    });
    const res = await wrapped(makeReq("http://localhost/api/test", "POST"));

    expect(handler).not.toHaveBeenCalled();
    expect(res).toBe(cachedResponse);
  });

  it("does NOT check idempotency for GET even if option is set", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ data: "ok" }));

    const wrapped = withRoute("/api/test", "GET", handler, {
      idempotent: true,
    });
    await wrapped(makeReq());

    expect(mockCheckIdempotency).not.toHaveBeenCalled();
  });

  it("passes context (params) through to the handler", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ data: "ok" }));

    const ctx = { params: Promise.resolve({ id: "abc" }) };
    const wrapped = withRoute("/api/test/[id]", "GET", handler);
    await wrapped(makeReq(), ctx);

    expect(handler).toHaveBeenCalledWith(expect.any(NextRequest), ctx);
  });
});
