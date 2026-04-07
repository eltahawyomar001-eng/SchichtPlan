// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { withRetry } from "@/lib/prisma-retry";

describe("withRetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns result on first success", async () => {
    const result = await withRetry(() => Promise.resolve("ok"), "test");
    expect(result).toBe("ok");
  });

  it("retries on P1001 (can't reach database) and succeeds", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      if (attempt < 3) {
        const err = new Error("Can't reach database server") as Error & {
          code: string;
        };
        err.code = "P1001";
        throw err;
      }
      return "recovered";
    };

    const result = await withRetry(op, "db-test");
    expect(result).toBe("recovered");
    expect(attempt).toBe(3);
  });

  it("retries on P2024 (pool exhaustion) and succeeds", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      if (attempt === 1) {
        const err = new Error(
          "Timed out fetching connection from pool",
        ) as Error & { code: string };
        err.code = "P2024";
        throw err;
      }
      return "ok";
    };

    const result = await withRetry(op, "pool-test");
    expect(result).toBe("ok");
    expect(attempt).toBe(2);
  });

  it("does NOT retry on non-retryable error codes", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      const err = new Error("Unique constraint failed") as Error & {
        code: string;
      };
      err.code = "P2002";
      throw err;
    };

    await expect(withRetry(op, "unique-test")).rejects.toThrow(
      "Unique constraint failed",
    );
    expect(attempt).toBe(1);
  });

  it("does NOT retry on errors without a code", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      throw new Error("Some random error");
    };

    await expect(withRetry(op, "random-test")).rejects.toThrow(
      "Some random error",
    );
    expect(attempt).toBe(1);
  });

  it("gives up after MAX_RETRIES (3 retries = 4 total attempts)", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      const err = new Error("Connection closed") as Error & { code: string };
      err.code = "P1017";
      throw err;
    };

    await expect(withRetry(op, "exhaust-test")).rejects.toThrow(
      "Connection closed",
    );
    // Initial attempt + 3 retries = 4 total
    expect(attempt).toBe(4);
  });

  it("logs a warning on each retry", async () => {
    const { log } = await import("@/lib/logger");
    vi.mocked(log.warn).mockClear();

    let attempt = 0;
    const op = async () => {
      attempt++;
      if (attempt <= 2) {
        const err = new Error("Timeout") as Error & { code: string };
        err.code = "P1008";
        throw err;
      }
      return "done";
    };

    await withRetry(op, "log-test");
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Retrying log-test"),
      expect.objectContaining({ code: "P1008" }),
    );
  });
});
