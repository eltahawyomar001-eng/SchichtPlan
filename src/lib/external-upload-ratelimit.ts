/**
 * Shared in-memory sliding-window rate limiter for the public external ticket
 * attachment endpoints (sign + finalize). Best-effort: per-instance state that
 * resets on cold start. Both phases share one bucket so a single upload session
 * (1 sign + 1 finalize) counts as two requests.
 */

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10; // ~5 upload sessions per token per minute
const rateBuckets = new Map<string, number[]>();

/** Returns true if the request is allowed, false if the token is over budget. */
export function externalUploadRateLimit(token: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(token) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (arr.length >= RATE_LIMIT) {
    rateBuckets.set(token, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(token, arr);
  return true;
}
