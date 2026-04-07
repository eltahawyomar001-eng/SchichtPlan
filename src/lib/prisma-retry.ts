/* ═══════════════════════════════════════════════════════════════
   Prisma Retry Wrapper (R3 — Transient DB Failure Resilience)
   ═══════════════════════════════════════════════════════════════
   Wraps Prisma operations with exponential-backoff retry logic
   for transient database errors (pool exhaustion, timeouts, etc.).

   Usage:
     const result = await withRetry(
       () => prisma.$transaction(async (tx) => { ... }),
       "/api/time-entries/clock POST"
     );
   ═══════════════════════════════════════════════════════════════ */

import { log } from "@/lib/logger";

/** Prisma error codes that are safe to retry (transient failures). */
const RETRYABLE_CODES = [
  "P1001", // Can't reach database server
  "P1002", // Database server timeout
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

/**
 * Retry a Prisma operation with exponential backoff on transient errors.
 *
 * @param operation — async function containing the Prisma call
 * @param label — human-readable label for logging (e.g. route path)
 * @returns the result of the operation
 * @throws the original error if non-retryable or max retries exceeded
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code: string }).code
          : "";

      if (!RETRYABLE_CODES.includes(code) || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      log.warn(
        `Retrying ${label} (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delay}ms`,
        { code },
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
