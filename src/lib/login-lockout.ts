import { Redis } from "@upstash/redis";
import { log } from "@/lib/logger";

/* ──────────────────────────────────────────────────────────────
 * Brute-force login protection (DSGVO Art. 32 – technical measure)
 *
 * Tracks failed login attempts per email in Upstash Redis.
 * After MAX_ATTEMPTS failures within the TTL window the account
 * is locked for LOCKOUT_SECONDS.
 *
 * Design decisions:
 * - Uses Redis (not DB) so lockout survives serverless cold-starts
 *   and avoids extra Prisma migrations.
 * - In-memory LRU fallback when Upstash env vars are missing (dev
 *   mode or Redis outage) — prevents bypassing lockout entirely.
 * ────────────────────────────────────────────────────────────── */

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const ATTEMPT_PREFIX = "login_attempts:";
const LOCKOUT_PREFIX = "login_locked:";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

/* ── In-memory fallback (LRU, 1000 entries max) ────────────── */

interface MemEntry {
  value: number | string;
  expiresAt: number;
}

const MEM_MAX = 1000;
const memStore = new Map<string, MemEntry>();

function memGet(key: string): number | string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: number | string, ttlSec: number): void {
  if (memStore.size >= MEM_MAX) {
    const oldest = memStore.keys().next().value;
    if (oldest) memStore.delete(oldest);
  }
  memStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

function memIncr(key: string, ttlSec: number): number {
  const current = memGet(key);
  const next = typeof current === "number" ? current + 1 : 1;
  memSet(key, next, ttlSec);
  return next;
}

function memDel(key: string): void {
  memStore.delete(key);
}

function memTtl(key: string): number {
  const entry = memStore.get(key);
  if (!entry) return -2;
  const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : -2;
}

/**
 * Check whether the email is currently locked out.
 * Returns the number of remaining seconds, or 0 if not locked.
 */
export async function isLockedOut(email: string): Promise<number> {
  const lockKey = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  if (!redis) {
    const ttl = memTtl(lockKey);
    return ttl > 0 ? ttl : 0;
  }

  try {
    const ttl = await redis.ttl(lockKey);
    return ttl > 0 ? ttl : 0;
  } catch (err) {
    log.error("login-lockout: isLockedOut Redis failed, using memory", {
      error: err,
    });
    const ttl = memTtl(lockKey);
    return ttl > 0 ? ttl : 0;
  }
}

/**
 * Record a failed login attempt.
 * Once MAX_ATTEMPTS is reached the account is locked for LOCKOUT_SECONDS.
 * Returns `true` if the account is now locked.
 */
export async function recordFailedAttempt(email: string): Promise<boolean> {
  const key = `${ATTEMPT_PREFIX}${email.toLowerCase()}`;
  const lockKey = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  if (!redis) {
    const attempts = memIncr(key, LOCKOUT_SECONDS);
    if (attempts >= MAX_ATTEMPTS) {
      memSet(lockKey, "1", LOCKOUT_SECONDS);
      memDel(key);
      log.warn("login-lockout: account locked (memory)", {
        email: email.toLowerCase(),
      });
      return true;
    }
    return false;
  }

  try {
    const attempts = await redis.incr(key);
    // First attempt → set TTL so the counter expires automatically
    if (attempts === 1) {
      await redis.expire(key, LOCKOUT_SECONDS);
    }

    if (attempts >= MAX_ATTEMPTS) {
      // Set lockout key
      await redis.set(lockKey, "1", {
        ex: LOCKOUT_SECONDS,
      });
      // Reset attempt counter
      await redis.del(key);
      log.warn("login-lockout: account locked", { email: email.toLowerCase() });
      return true;
    }

    return false;
  } catch (err) {
    log.error("login-lockout: recordFailedAttempt Redis failed, using memory", {
      error: err,
    });
    const attempts = memIncr(key, LOCKOUT_SECONDS);
    if (attempts >= MAX_ATTEMPTS) {
      memSet(lockKey, "1", LOCKOUT_SECONDS);
      memDel(key);
      return true;
    }
    return false;
  }
}

/**
 * Clear failed attempts after a successful login.
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const attemptKey = `${ATTEMPT_PREFIX}${email.toLowerCase()}`;
  const lockKey = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  // Always clear memory fallback
  memDel(attemptKey);
  memDel(lockKey);

  if (!redis) return;

  try {
    await redis.del(attemptKey);
    await redis.del(lockKey);
  } catch (err) {
    log.error("login-lockout: clearFailedAttempts failed", { error: err });
  }
}
