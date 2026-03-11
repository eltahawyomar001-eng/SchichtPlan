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
 * - Gracefully degrades if Upstash env vars are missing (dev mode).
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

/**
 * Check whether the email is currently locked out.
 * Returns the number of remaining seconds, or 0 if not locked.
 */
export async function isLockedOut(email: string): Promise<number> {
  if (!redis) return 0;
  try {
    const ttl = await redis.ttl(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
    return ttl > 0 ? ttl : 0;
  } catch (err) {
    log.error("login-lockout: isLockedOut failed", { error: err });
    return 0; // fail-open
  }
}

/**
 * Record a failed login attempt.
 * Once MAX_ATTEMPTS is reached the account is locked for LOCKOUT_SECONDS.
 * Returns `true` if the account is now locked.
 */
export async function recordFailedAttempt(email: string): Promise<boolean> {
  if (!redis) return false;
  const key = `${ATTEMPT_PREFIX}${email.toLowerCase()}`;

  try {
    const attempts = await redis.incr(key);
    // First attempt → set TTL so the counter expires automatically
    if (attempts === 1) {
      await redis.expire(key, LOCKOUT_SECONDS);
    }

    if (attempts >= MAX_ATTEMPTS) {
      // Set lockout key
      await redis.set(`${LOCKOUT_PREFIX}${email.toLowerCase()}`, "1", {
        ex: LOCKOUT_SECONDS,
      });
      // Reset attempt counter
      await redis.del(key);
      log.warn("login-lockout: account locked", { email: email.toLowerCase() });
      return true;
    }

    return false;
  } catch (err) {
    log.error("login-lockout: recordFailedAttempt failed", { error: err });
    return false; // fail-open
  }
}

/**
 * Clear failed attempts after a successful login.
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${ATTEMPT_PREFIX}${email.toLowerCase()}`);
    await redis.del(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
  } catch (err) {
    log.error("login-lockout: clearFailedAttempts failed", { error: err });
  }
}
