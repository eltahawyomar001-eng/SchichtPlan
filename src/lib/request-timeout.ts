/* ═══════════════════════════════════════════════════════════════
   Request / Promise Timeout (R4)
   ═══════════════════════════════════════════════════════════════
   Wraps a Promise with a timeout. If the promise doesn't resolve
   within `ms` milliseconds, the returned promise rejects with a
   descriptive timeout error.

   Usage:
     const response = await withTimeout(
       fetch(webhook.url, { ... }),
       10_000,
       `webhook ${webhook.url}`
     );
   ═══════════════════════════════════════════════════════════════ */

/**
 * Race a promise against a timeout.
 *
 * @param promise — the async operation to wrap
 * @param ms — timeout in milliseconds
 * @param label — human-readable label for the error message
 * @returns the result of the promise
 * @throws Error if the timeout fires first
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}
