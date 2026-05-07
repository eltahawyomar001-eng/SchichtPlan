import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { log } from "@/lib/logger";

/* ──────────────────────────────────────────────────────────────
 * QR-clock security: PIN brute-force lockout (C-1) and
 * per-employee/per-action token one-time-use tracking (C-2).
 *
 * C-1: After MAX_PIN_ATTEMPTS failed PINs for a (workspaceId, tokenSig)
 *      pair, all further punch attempts are rejected for LOCKOUT_SECONDS.
 *      Uses the same Redis + LRU-memory fallback pattern as login-lockout.
 *
 * C-2: A successful (employeeId, action, tokenSig) punch is marked as
 *      consumed for the remainder of the token's TTL. Prevents the same
 *      employee replaying the exact same punch with a captured QR code.
 *      Different employees can still punch with the same token (normal op).
 * ────────────────────────────────────────────────────────────── */

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 120; // covers 2 × 60-second token windows

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

/* ── In-process LRU fallback ───────────────────────────────── */
interface MemEntry {
  value: number | string;
  expiresAt: number;
}
const MEM_MAX = 500;
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
  const cur = memGet(key);
  const next = typeof cur === "number" ? cur + 1 : 1;
  memSet(key, next, ttlSec);
  return next;
}

function memTtl(key: string): number {
  const entry = memStore.get(key);
  if (!entry) return -2;
  const rem = Math.ceil((entry.expiresAt - Date.now()) / 1000);
  return rem > 0 ? rem : -2;
}

/* ── Helpers ────────────────────────────────────────────────── */

/**
 * Derive a short stable key from a QR token by hashing its signature
 * portion. Avoids storing the full token in Redis keys.
 */
export function tokenSignature(token: string): string {
  const dot = token.indexOf(".");
  const sigPart = dot >= 0 ? token.slice(dot + 1) : token;
  return crypto.createHash("sha256").update(sigPart).digest("hex").slice(0, 20);
}

/* ── C-1: PIN brute-force lockout ───────────────────────────── */

/**
 * Returns seconds remaining in lockout (>0), or 0 if not locked.
 */
export async function checkPinLockout(
  workspaceId: string,
  tokenSig: string,
): Promise<number> {
  const lockKey = `qr_pin_locked:${workspaceId}:${tokenSig}`;
  if (!redis) {
    const ttl = memTtl(lockKey);
    return ttl > 0 ? ttl : 0;
  }
  try {
    const ttl = await redis.ttl(lockKey);
    return ttl > 0 ? ttl : 0;
  } catch (err) {
    log.error("[qr-lockout] checkPinLockout Redis error, using memory", {
      err,
    });
    const ttl = memTtl(lockKey);
    return ttl > 0 ? ttl : 0;
  }
}

/**
 * Increment failure counter. Returns true when the lockout threshold is hit.
 */
export async function recordPinFailure(
  workspaceId: string,
  tokenSig: string,
): Promise<boolean> {
  const attemptKey = `qr_pin_attempts:${workspaceId}:${tokenSig}`;
  const lockKey = `qr_pin_locked:${workspaceId}:${tokenSig}`;

  if (!redis) {
    const attempts = memIncr(attemptKey, LOCKOUT_SECONDS);
    if (attempts >= MAX_PIN_ATTEMPTS) {
      memSet(lockKey, "1", LOCKOUT_SECONDS);
      memStore.delete(attemptKey);
      log.warn("[qr-lockout] PIN lockout triggered (memory)", { workspaceId });
      return true;
    }
    return false;
  }

  try {
    const attempts = await redis.incr(attemptKey);
    if (attempts === 1) await redis.expire(attemptKey, LOCKOUT_SECONDS);
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await redis.set(lockKey, "1", { ex: LOCKOUT_SECONDS });
      await redis.del(attemptKey);
      log.warn("[qr-lockout] PIN lockout triggered", { workspaceId });
      return true;
    }
    return false;
  } catch (err) {
    log.error("[qr-lockout] recordPinFailure Redis error, using memory", {
      err,
    });
    const attempts = memIncr(attemptKey, LOCKOUT_SECONDS);
    if (attempts >= MAX_PIN_ATTEMPTS) {
      memSet(lockKey, "1", LOCKOUT_SECONDS);
      memStore.delete(attemptKey);
      return true;
    }
    return false;
  }
}

/** Clear attempt counter on successful punch to allow future corrections. */
export async function clearPinAttempts(
  workspaceId: string,
  tokenSig: string,
): Promise<void> {
  const attemptKey = `qr_pin_attempts:${workspaceId}:${tokenSig}`;
  memStore.delete(attemptKey);
  if (!redis) return;
  try {
    await redis.del(attemptKey);
  } catch {
    /* best-effort */
  }
}

/* ── C-2: Token one-time-use per (employee, action) ─────────── */

/**
 * Mark an (employeeId, action, tokenSig) as consumed for `ttlSeconds`.
 * Returns true if this is the first use; false if already consumed (replay).
 * Fails-open on Redis error to prefer availability over replay prevention.
 */
export async function consumePunch(
  employeeId: string,
  action: string,
  tokenSig: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = `qr_punch:${employeeId}:${action}:${tokenSig}`;
  const safeTtl = Math.max(ttlSeconds, 1);

  if (!redis) {
    if (memGet(key) !== null) return false;
    memSet(key, "1", safeTtl);
    return true;
  }

  try {
    const result = await redis.set(key, "1", { nx: true, ex: safeTtl });
    return result !== null;
  } catch (err) {
    log.warn(
      "[qr-lockout] consumePunch Redis unavailable — rejecting to prevent replay",
      {
        err,
      },
    );
    return false; // fail-closed: replay prevention > availability on Redis outage
  }
}
