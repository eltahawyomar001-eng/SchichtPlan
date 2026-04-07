// @vitest-environment node
import { describe, it, expect } from "vitest";
import { withTimeout } from "@/lib/request-timeout";

describe("withTimeout", () => {
  it("resolves if promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("fast"), 1000, "fast-op");
    expect(result).toBe("fast");
  });

  it("rejects with timeout error if promise exceeds timeout", async () => {
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("slow"), 500),
    );

    await expect(withTimeout(slow, 50, "slow-op")).rejects.toThrow(
      "slow-op timed out after 50ms",
    );
  });

  it("includes the label and ms in the error message", async () => {
    const never = new Promise<void>(() => {});
    try {
      await withTimeout(never, 30, "webhook https://example.com");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe(
        "webhook https://example.com timed out after 30ms",
      );
    }
  });

  it("propagates the original error if promise rejects before timeout", async () => {
    const failing = Promise.reject(new Error("network failure"));

    await expect(withTimeout(failing, 5000, "fetch-test")).rejects.toThrow(
      "network failure",
    );
  });

  it("returns the correct type", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, "number-op");
    expect(result).toBe(42);
    expect(typeof result).toBe("number");
  });
});
