/**
 * Offline module — Cache manager + Sync engine.
 *
 * @example
 * import { cacheManager, syncEngine } from "@/lib/offline";
 *
 * // Cache data
 * const shifts = await cacheManager.getOrFetch("shifts", key, fetchFn);
 *
 * // Queue an offline mutation
 * await syncEngine.queueMutation("CLOCK_IN", { action: "in" });
 */

export { cacheManager } from "./cache-manager";
export {
  syncEngine,
  type MutationType,
  type PendingMutation,
  type SyncProgress,
  type SyncResult,
} from "./sync-engine";
