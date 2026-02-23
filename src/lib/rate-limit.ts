import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   In-memory sliding-window rate limiter
   ═══════════════════════════════════════════════════════════════
   No external dependencies — uses a simple Map with TTL-based
   automatic cleanup. For multi-instance deployments swap this
   with Upstash Redis or similar.
   ═══════════════════════════════════════════════════════════════ */

interface RateLimitEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 5 minutes to avoid memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/** Pre-configured limits for common use cases */
export const RATE_LIMITS = {
  /** Auth routes (login, register, forgot-password) — 10 req / 60s */
  auth: { maxRequests: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** Sensitive mutation endpoints — 30 req / 60s */
  mutation: { maxRequests: 30, windowMs: 60_000 } satisfies RateLimitConfig,
  /** General API reads — 60 req / 60s */
  read: { maxRequests: 60, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;

/**
 * Extract a client identifier from the request.
 * Uses X-Forwarded-For (set by Vercel / reverse proxies) then
 * falls back to a generic key.
 */
function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // Next.js edge: no raw socket — use a safe fallback
  return "unknown-client";
}

/**
 * Check rate limit. Returns `null` if under the limit,
 * or a 429 NextResponse if over.
 *
 * Usage in API routes:
 *
 *   const limited = rateLimit(req, "auth");
 *   if (limited) return limited;
 */
export function rateLimit(
  req: Request,
  preset: keyof typeof RATE_LIMITS,
): NextResponse | null {
  const config = RATE_LIMITS[preset];
  return rateLimitCustom(req, config);
}

/**
 * Check rate limit with a custom config.
 */
export function rateLimitCustom(
  req: Request,
  { maxRequests, windowMs }: RateLimitConfig,
): NextResponse | null {
  cleanup(windowMs);

  const now = Date.now();
  const key = `${getClientKey(req)}`;
  const entry = store.get(key) ?? { timestamps: [] };

  // Remove timestamps outside current window
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const retryAfterSec = Math.ceil(
      (entry.timestamps[0] + windowMs - now) / 1000,
    );
    return NextResponse.json(
      {
        error: "RATE_LIMIT",
        message: "Too many requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return null;
}
