/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, rateLimitCustom, RATE_LIMITS } from "@/lib/rate-limit";
import { buildRequestWithIp } from "../helpers/factories";

/* ═══════════════════════════════════════════════════════════════
   Rate Limiter — integration tests
   ═══════════════════════════════════════════════════════════════ */

describe("rate-limit", () => {
  // Each test uses a unique IP so they don't interfere
  let testIp: string;
  let counter = 0;

  beforeEach(() => {
    counter += 1;
    testIp = `10.0.0.${counter}`;
  });

  // ─── Preset Configurations ────────────────────────────────

  describe("RATE_LIMITS presets", () => {
    it("auth preset allows 10 requests per 60s", () => {
      expect(RATE_LIMITS.auth.maxRequests).toBe(10);
      expect(RATE_LIMITS.auth.windowMs).toBe(60_000);
    });

    it("mutation preset allows 30 requests per 60s", () => {
      expect(RATE_LIMITS.mutation.maxRequests).toBe(30);
      expect(RATE_LIMITS.mutation.windowMs).toBe(60_000);
    });

    it("read preset allows 60 requests per 60s", () => {
      expect(RATE_LIMITS.read.maxRequests).toBe(60);
      expect(RATE_LIMITS.read.windowMs).toBe(60_000);
    });
  });

  // ─── Core Rate Limiting Behaviour ─────────────────────────

  describe("rateLimit", () => {
    it("returns null when under the limit", () => {
      const req = buildRequestWithIp(testIp);
      const result = rateLimit(req, "auth");
      expect(result).toBeNull();
    });

    it("returns 429 when limit is exceeded", async () => {
      // Use a very small custom limit for speed
      const config = { maxRequests: 3, windowMs: 60_000 };

      for (let i = 0; i < 3; i++) {
        const req = buildRequestWithIp(testIp);
        expect(rateLimitCustom(req, config)).toBeNull();
      }

      // 4th request should be blocked
      const req = buildRequestWithIp(testIp);
      const result = rateLimitCustom(req, config);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);

      const body = await result!.json();
      expect(body.error).toBe("RATE_LIMIT");
      expect(body.message).toContain("Too many requests");
    });

    it("includes proper rate-limit headers on 429", async () => {
      const config = { maxRequests: 2, windowMs: 60_000 };

      for (let i = 0; i < 2; i++) {
        rateLimitCustom(buildRequestWithIp(testIp), config);
      }

      const result = rateLimitCustom(buildRequestWithIp(testIp), config);
      expect(result).not.toBeNull();
      expect(result!.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(result!.headers.get("Retry-After")).toBeDefined();

      const retryAfter = parseInt(result!.headers.get("Retry-After")!, 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it("isolates rate limits by IP address", () => {
      const config = { maxRequests: 1, windowMs: 60_000 };

      // First IP hits limit
      const ip1 = `isolated-${counter}-a`;
      const ip2 = `isolated-${counter}-b`;

      expect(rateLimitCustom(buildRequestWithIp(ip1), config)).toBeNull();
      expect(rateLimitCustom(buildRequestWithIp(ip1), config)).not.toBeNull();

      // Second IP should still be under the limit
      expect(rateLimitCustom(buildRequestWithIp(ip2), config)).toBeNull();
    });

    it("falls back to unknown-client when no x-forwarded-for", () => {
      // Request without IP header
      const req = new Request("http://localhost/api/test");
      const config = { maxRequests: 100, windowMs: 60_000 };
      const result = rateLimitCustom(req, config);
      expect(result).toBeNull();
    });
  });

  // ─── Sliding Window Behaviour ─────────────────────────────

  describe("sliding window", () => {
    it("allows requests again after window expires", async () => {
      const config = { maxRequests: 2, windowMs: 50 }; // 50ms window

      // Fill the window
      expect(rateLimitCustom(buildRequestWithIp(testIp), config)).toBeNull();
      expect(rateLimitCustom(buildRequestWithIp(testIp), config)).toBeNull();
      expect(
        rateLimitCustom(buildRequestWithIp(testIp), config),
      ).not.toBeNull();

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 60));

      // Should be allowed again
      expect(rateLimitCustom(buildRequestWithIp(testIp), config)).toBeNull();
    });
  });

  // ─── Preset Integration ───────────────────────────────────

  describe("preset integration", () => {
    it("auth preset blocks after 10 requests from same IP", () => {
      for (let i = 0; i < 10; i++) {
        expect(rateLimit(buildRequestWithIp(testIp), "auth")).toBeNull();
      }
      expect(rateLimit(buildRequestWithIp(testIp), "auth")).not.toBeNull();
    });
  });
});
