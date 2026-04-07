/* ═══════════════════════════════════════════════════════════════
   Idempotency-Key Support (H6)
   ═══════════════════════════════════════════════════════════════
   Prevents duplicate writes when a client retries a failed/timed-out
   POST request. Uses Upstash Redis to store and retrieve cached
   responses keyed by the `Idempotency-Key` header.

   Usage in a POST route handler:

     import { checkIdempotency, cacheIdempotentResponse } from "@/lib/idempotency";

     export async function POST(req: Request) {
       // 1. Check for cached response
       const cached = await checkIdempotency(req);
       if (cached) return cached;

       // 2. ... process the request ...
       const response = NextResponse.json({ data: result }, { status: 201 });

       // 3. Cache the response for future identical requests
       await cacheIdempotentResponse(req, response);
       return response;
     }

   The Idempotency-Key header is optional. If not provided, the
   request is processed normally (no caching). If provided, the
   key is scoped to the requesting IP to prevent cross-user collisions.

   TTL: 24 hours — matches Stripe's idempotency window.
   ═══════════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { log } from "@/lib/logger";

/* ── Redis client (reuse from middleware or init lazily) ───── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

async function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Dynamic import to avoid bundling Redis client when not needed
  const { Redis } = await import("@upstash/redis");
  redis = new Redis({ url, token });
  return redis;
}

/* ── In-memory LRU fallback when Redis is unavailable ──────── */

interface MemoryEntry {
  data: CachedResponse;
  expiresAt: number;
}

const LRU_MAX_SIZE = 500;
const memoryCache = new Map<string, MemoryEntry>();

function memoryGet(key: string): CachedResponse | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  // Move to end (LRU refresh)
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.data;
}

function memorySet(key: string, data: CachedResponse, ttlMs: number): void {
  // Evict oldest entries if at capacity
  if (memoryCache.size >= LRU_MAX_SIZE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/* ── Constants ──────────────────────────────────────────────── */

const IDEMPOTENCY_PREFIX = "idempotency:";
const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours
const IDEMPOTENCY_HEADER = "idempotency-key";

/* ── Cached response shape stored in Redis ──────────────────── */

interface CachedResponse {
  status: number;
  body: string;
  contentType: string;
}

/* ── Helpers ────────────────────────────────────────────────── */

function getIdempotencyKey(req: Request): string | null {
  return req.headers.get(IDEMPOTENCY_HEADER);
}

function getRequestIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function buildRedisKey(idempotencyKey: string, ip: string): string {
  return `${IDEMPOTENCY_PREFIX}${ip}:${idempotencyKey}`;
}

/* ── Public API ─────────────────────────────────────────────── */

/**
 * Check if a response for this Idempotency-Key has already been cached.
 * Returns the cached NextResponse if found, or `null` if the request
 * should be processed normally.
 */
export async function checkIdempotency(
  req: Request,
): Promise<NextResponse | null> {
  const key = getIdempotencyKey(req);
  if (!key) return null; // No idempotency header — process normally

  // Validate key format (UUID or reasonable string, max 256 chars)
  if (key.length > 256) {
    return NextResponse.json(
      {
        error: "Idempotency-Key too long (max 256 characters)",
        code: "INVALID_IDEMPOTENCY_KEY",
      },
      { status: 400 },
    );
  }

  try {
    const client = await getRedis();
    const ip = getRequestIp(req);
    const cacheKey = buildRedisKey(key, ip);

    if (!client) {
      // Redis unavailable — use in-memory LRU fallback
      const memoryCached = memoryGet(cacheKey);
      if (!memoryCached) return null;

      log.info("Idempotent request — returning cached response (memory)", {
        idempotencyKey: key,
        status: memoryCached.status,
      });

      return new NextResponse(memoryCached.body, {
        status: memoryCached.status,
        headers: {
          "Content-Type": memoryCached.contentType,
          "Idempotency-Replayed": "true",
        },
      });
    }

    const raw = await client.get(cacheKey);

    if (!raw) return null; // First time seeing this key

    // Parse cached response
    const cached: CachedResponse =
      typeof raw === "string" ? JSON.parse(raw) : (raw as CachedResponse);

    log.info("Idempotent request — returning cached response", {
      idempotencyKey: key,
      status: cached.status,
    });

    return new NextResponse(cached.body, {
      status: cached.status,
      headers: {
        "Content-Type": cached.contentType,
        "Idempotency-Replayed": "true",
      },
    });
  } catch (error) {
    // Redis error — degrade gracefully, process the request normally
    log.warn("Idempotency check failed — processing request normally", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Cache the response for this Idempotency-Key in Redis.
 * Call this after successfully processing a POST request.
 */
export async function cacheIdempotentResponse(
  req: Request,
  response: NextResponse,
): Promise<void> {
  const key = getIdempotencyKey(req);
  if (!key) return; // No idempotency header — nothing to cache

  try {
    const client = await getRedis();

    const ip = getRequestIp(req);
    const cacheKey = buildRedisKey(key, ip);

    // Clone the response to read the body without consuming it
    const cloned = response.clone();
    const body = await cloned.text();

    const cached: CachedResponse = {
      status: response.status,
      body,
      contentType: response.headers.get("Content-Type") || "application/json",
    };

    if (!client) {
      // Redis unavailable — cache in memory only
      memorySet(cacheKey, cached, IDEMPOTENCY_TTL_SECONDS * 1000);
      return;
    }

    await client.set(cacheKey, JSON.stringify(cached), {
      ex: IDEMPOTENCY_TTL_SECONDS,
    });

    // Also cache in memory for faster subsequent hits
    memorySet(cacheKey, cached, IDEMPOTENCY_TTL_SECONDS * 1000);
  } catch (error) {
    // Non-critical — log but don't fail the response
    log.warn("Failed to cache idempotent response", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
