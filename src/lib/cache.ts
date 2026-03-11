import { Redis } from "@upstash/redis";
import { log } from "@/lib/logger";

/* ──────────────────────────────────────────────────────────────
 * Application-level cache backed by Upstash Redis
 *
 * Provides typed get/set/del helpers with automatic JSON
 * serialisation and configurable TTL.  Falls back to an
 * in-memory Map when Upstash env vars are missing (local dev).
 *
 * Usage:
 *   import { cache } from "@/lib/cache";
 *   const user = await cache.get<User>(`user:${id}`);
 *   await cache.set(`user:${id}`, user, 300);   // 5 min TTL
 *   await cache.del(`user:${id}`);
 *   await cache.delPattern("user:*");            // bulk invalidation
 * ────────────────────────────────────────────────────────────── */

const CACHE_PREFIX = "shiftfy:";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

/* ── In-memory fallback for development ── */
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

function prefixed(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/** Get a cached value by key. Returns `null` on miss or error. */
async function get<T = unknown>(key: string): Promise<T | null> {
  const k = prefixed(key);

  if (redis) {
    try {
      const value = await redis.get<T>(k);
      return value ?? null;
    } catch (err) {
      log.error("cache.get failed", { key, error: err });
      return null; // fail-open
    }
  }

  // In-memory fallback
  const entry = memoryCache.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(k);
    return null;
  }
  return entry.data as T;
}

/** Set a cached value with TTL in seconds (default 300 = 5 min). */
async function set(
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<void> {
  const k = prefixed(key);

  if (redis) {
    try {
      await redis.set(k, value, { ex: ttlSeconds });
    } catch (err) {
      log.error("cache.set failed", { key, error: err });
    }
    return;
  }

  // In-memory fallback
  memoryCache.set(k, {
    data: value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/** Delete a single cached key. */
async function del(key: string): Promise<void> {
  const k = prefixed(key);

  if (redis) {
    try {
      await redis.del(k);
    } catch (err) {
      log.error("cache.del failed", { key, error: err });
    }
    return;
  }

  memoryCache.delete(k);
}

/**
 * Delete all keys matching a prefix pattern.
 * Example: `cache.delPattern("workspace:abc123:*")`
 *
 * Uses SCAN to avoid blocking Redis. Falls back to iterating
 * the in-memory map in development.
 */
async function delPattern(pattern: string): Promise<void> {
  const p = prefixed(pattern);

  if (redis) {
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: p,
          count: 100,
        });
        cursor = Number(nextCursor);
        if (keys.length > 0) {
          await redis.del(...(keys as string[]));
        }
      } while (cursor !== 0);
    } catch (err) {
      log.error("cache.delPattern failed", { pattern, error: err });
    }
    return;
  }

  // In-memory fallback — convert glob "*" to a simple prefix match
  const prefix = p.replace(/\*/g, "");
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }
}

/** Check if Redis is connected (for health checks). */
async function ping(): Promise<boolean> {
  if (!redis) return false;
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export const cache = { get, set, del, delPattern, ping };
