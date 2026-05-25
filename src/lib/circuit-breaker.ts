import { cache } from "@/lib/cache";
import { log } from "@/lib/logger";

/* ──────────────────────────────────────────────────────────────
 * Redis-backed circuit breaker
 *
 * Tracks consecutive failures per named service in Redis so the
 * open/closed state is shared across all serverless instances.
 *
 * State machine:
 *   CLOSED   — normal operation; failures are counted
 *   OPEN     — fast-fail for RESET_TIMEOUT_MS after FAILURE_THRESHOLD failures
 *   HALF_OPEN — allows one probe call after the timeout expires; success
 *               resets to CLOSED, failure re-opens
 * ────────────────────────────────────────────────────────────── */

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60_000; // 60 s open window

type CbState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker open for: ${name}`);
    this.name = "CircuitOpenError";
  }
}

async function getState(name: string): Promise<CbState> {
  const openedAt = await cache.get<number>(`cb:${name}:openedAt`);
  if (!openedAt) return "CLOSED";
  return Date.now() - openedAt < RESET_TIMEOUT_MS ? "OPEN" : "HALF_OPEN";
}

async function recordFailure(name: string): Promise<void> {
  const count = ((await cache.get<number>(`cb:${name}:failures`)) ?? 0) + 1;
  await cache.set(`cb:${name}:failures`, count, 300);
  if (count >= FAILURE_THRESHOLD) {
    await cache.set(`cb:${name}:openedAt`, Date.now(), 120);
    log.warn(`[CircuitBreaker] ${name} OPENED after ${count} failures`);
  }
}

async function reset(name: string): Promise<void> {
  await cache.del(`cb:${name}:failures`);
  await cache.del(`cb:${name}:openedAt`);
}

/**
 * Execute `fn` through the circuit breaker for `name`.
 * Throws `CircuitOpenError` immediately when the circuit is open.
 * Callers should catch `CircuitOpenError` and return a graceful degraded response.
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const state = await getState(name);

  if (state === "OPEN") {
    throw new CircuitOpenError(name);
  }

  try {
    const result = await fn();
    if (state === "HALF_OPEN") {
      await reset(name);
      log.info(`[CircuitBreaker] ${name} CLOSED (probe succeeded)`);
    } else {
      // Clear accumulated failures on any success
      const failures = await cache.get<number>(`cb:${name}:failures`);
      if (failures && failures > 0) await cache.del(`cb:${name}:failures`);
    }
    return result;
  } catch (err) {
    if (err instanceof CircuitOpenError) throw err;
    await recordFailure(name);
    throw err;
  }
}
