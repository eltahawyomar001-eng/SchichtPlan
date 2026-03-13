/**
 * Sync Engine — Offline mutation queue with background sync.
 *
 * Extends the original `offline-store.ts` to support the full set of
 * offline-capable mutations (clock-in/out, shift CRUD, absence requests).
 *
 * Features:
 * - Exponential backoff (1s → 16s) with max 5 retries
 * - BackgroundSync API registration when available
 * - Event-driven: dispatches 'sync-progress' and 'sync-complete' events
 * - FIFO processing order (by queuedAt)
 * - Idempotency tokens per mutation
 *
 * @see offline-store.ts for the legacy CHECK_IN/CHECK_OUT/SIGNATURE sync
 */

import { getDeviceId } from "@/lib/offline-store";

/* ── Constants ── */

const DB_NAME = "shiftfy-offline";
const DB_VERSION = 2;
const STORE_NAME = "pendingMutations";
const SYNC_TAG = "shiftfy-bg-sync";
const MAX_RETRIES = 5;
/** Base delay for exponential backoff (ms) */
const BASE_DELAY_MS = 1_000;

/* ── Mutation Types ── */

export type MutationType =
  | "CLOCK_IN"
  | "CLOCK_OUT"
  | "BREAK_START"
  | "BREAK_END"
  | "CREATE_SHIFT"
  | "UPDATE_SHIFT"
  | "DELETE_SHIFT"
  | "CREATE_ABSENCE_REQUEST"
  | "CREATE_TIME_ENTRY"
  | "UPDATE_TIME_ENTRY";

export interface PendingMutation {
  /** Auto-increment key set by IndexedDB */
  id?: number;
  /** Mutation type — determines endpoint and HTTP method */
  type: MutationType;
  /** API endpoint path (e.g., /api/time-entries/clock) */
  endpoint: string;
  /** HTTP method (POST, PUT, PATCH, DELETE) */
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Request body */
  payload: Record<string, unknown>;
  /** UUID for idempotency — server can deduplicate */
  idempotencyKey: string;
  /** ISO-8601 timestamp when the mutation was queued */
  queuedAt: string;
  /** Device UUID */
  deviceId: string;
  /** Number of sync attempts so far */
  retryCount: number;
  /** Last error message if sync failed */
  lastError?: string;
  /** Optimistic ID — used to match client-side optimistic updates */
  optimisticId?: string;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
}

export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{ mutationId: number; type: MutationType; error: string }>;
}

/* ── Mutation Endpoint Map ── */

const MUTATION_CONFIG: Record<
  MutationType,
  { endpoint: string; method: "POST" | "PUT" | "PATCH" | "DELETE" }
> = {
  CLOCK_IN: { endpoint: "/api/time-entries/clock", method: "POST" },
  CLOCK_OUT: { endpoint: "/api/time-entries/clock", method: "POST" },
  BREAK_START: { endpoint: "/api/time-entries/clock", method: "POST" },
  BREAK_END: { endpoint: "/api/time-entries/clock", method: "POST" },
  CREATE_SHIFT: { endpoint: "/api/shifts", method: "POST" },
  UPDATE_SHIFT: { endpoint: "/api/shifts", method: "PATCH" },
  DELETE_SHIFT: { endpoint: "/api/shifts", method: "DELETE" },
  CREATE_ABSENCE_REQUEST: { endpoint: "/api/absences", method: "POST" },
  CREATE_TIME_ENTRY: { endpoint: "/api/time-entries", method: "POST" },
  UPDATE_TIME_ENTRY: { endpoint: "/api/time-entries", method: "PATCH" },
};

/** Map mutation type to the clock action string the API expects */
const CLOCK_ACTION_MAP: Partial<Record<MutationType, string>> = {
  CLOCK_IN: "in",
  CLOCK_OUT: "out",
  BREAK_START: "break-start",
  BREAK_END: "break-end",
};

/* ── IndexedDB Helpers ── */

function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("queuedAt", "queuedAt", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

/* ── Queue API ── */

/**
 * Queue a mutation for offline sync.
 *
 * @returns The auto-increment ID of the queued mutation.
 */
export async function queueMutation(
  type: MutationType,
  payload: Record<string, unknown>,
  options?: { optimisticId?: string; endpointOverride?: string },
): Promise<number> {
  if (!isIndexedDBAvailable()) {
    throw new Error(
      "IndexedDB is not available — cannot queue offline mutation",
    );
  }

  const config = MUTATION_CONFIG[type];
  const endpoint = options?.endpointOverride ?? config.endpoint;

  // For clock actions, inject the action string
  const clockAction = CLOCK_ACTION_MAP[type];
  const finalPayload = clockAction
    ? { ...payload, action: clockAction }
    : payload;

  const mutation: Omit<PendingMutation, "id"> = {
    type,
    endpoint,
    method: config.method,
    payload: finalPayload,
    idempotencyKey: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    retryCount: 0,
    optimisticId: options?.optimisticId,
  };

  const db = await openDB();
  const id = await new Promise<number>((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const request = store.add(mutation);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });

  // Register for Background Sync if available
  await registerBackgroundSync();

  // Dispatch event for UI updates
  dispatchSyncEvent("mutation-queued", { id, type });

  return id;
}

/**
 * Get all pending mutations, ordered by queuedAt (FIFO).
 */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  if (!isIndexedDBAvailable()) return [];

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const store = txStore(db, "readonly");
      const index = store.index("queuedAt");
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get count of pending mutations.
 */
export async function getPendingMutationCount(): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const store = txStore(db, "readonly");
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Remove a successfully synced mutation.
 */
async function removeMutation(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const store = txStore(db, "readwrite");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

/**
 * Update a mutation after a failed sync attempt.
 */
async function markRetry(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const store = txStore(db, "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const mutation = getReq.result as PendingMutation | undefined;
      if (!mutation) {
        resolve();
        return;
      }
      mutation.retryCount += 1;
      mutation.lastError = error;
      const putReq = store.put(mutation);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => resolve();
    };
    getReq.onerror = () => resolve();
  });
}

/**
 * Clear all pending mutations (e.g., after logout).
 */
export async function clearAllMutations(): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const store = txStore(db, "readwrite");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // fail-open
  }
}

/* ── Sync Engine ── */

/** Tracks whether a sync is currently in progress */
let isSyncing = false;

/**
 * Exponential backoff delay: 1s, 2s, 4s, 8s, 16s.
 */
function getBackoffDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 16_000);
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sync all pending mutations to the server.
 *
 * Processes mutations in FIFO order. Includes the idempotency key
 * in headers so the server can deduplicate repeated attempts.
 *
 * Dispatches 'sync-progress' CustomEvents on window for UI updates.
 */
export async function syncPendingMutations(): Promise<SyncResult> {
  if (isSyncing) {
    return { synced: 0, failed: 0, errors: [] };
  }

  isSyncing = true;
  const mutations = await getPendingMutations();
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };
  const total = mutations.length;

  dispatchSyncEvent("sync-start", { total });

  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i];

    if (mutation.retryCount >= MAX_RETRIES) {
      result.failed++;
      result.errors.push({
        mutationId: mutation.id!,
        type: mutation.type,
        error: `Max retries (${MAX_RETRIES}) exceeded: ${mutation.lastError}`,
      });
      continue;
    }

    // Backoff if this is a retry
    if (mutation.retryCount > 0) {
      await sleep(getBackoffDelay(mutation.retryCount));
    }

    const progress: SyncProgress = {
      total,
      completed: result.synced + result.failed,
      failed: result.failed,
      current: mutation.type,
    };
    dispatchSyncEvent("sync-progress", progress);

    try {
      const response = await fetch(mutation.endpoint, {
        method: mutation.method,
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": mutation.idempotencyKey,
          "X-Offline-Sync": "true",
          "X-Client-Timestamp": mutation.queuedAt,
          "X-Device-Id": mutation.deviceId,
        },
        body:
          mutation.method !== "DELETE"
            ? JSON.stringify(mutation.payload)
            : undefined,
      });

      if (response.ok) {
        await removeMutation(mutation.id!);
        result.synced++;
        dispatchSyncEvent("mutation-synced", {
          id: mutation.id,
          type: mutation.type,
          optimisticId: mutation.optimisticId,
        });
      } else if (response.status === 409) {
        // Conflict — mutation was already processed (idempotency)
        await removeMutation(mutation.id!);
        result.synced++;
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        await markRetry(mutation.id!, `HTTP ${response.status}: ${errorText}`);
        result.failed++;
        result.errors.push({
          mutationId: mutation.id!,
          type: mutation.type,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      await markRetry(mutation.id!, message);
      result.failed++;
      result.errors.push({
        mutationId: mutation.id!,
        type: mutation.type,
        error: message,
      });

      // If we're offline, stop processing the rest
      if (!navigator.onLine) break;
    }
  }

  isSyncing = false;

  dispatchSyncEvent("sync-complete", result);

  return result;
}

/* ── Background Sync ── */

/**
 * Register for the Background Sync API if available.
 * This allows the service worker to trigger sync when connectivity
 * is restored — even if the page is closed.
 */
async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        }
      ).sync.register(SYNC_TAG);
    }
  } catch {
    // Background Sync not available — fall back to online listener
  }
}

/* ── Online Listener ── */

let onlineListenerRegistered = false;

/**
 * Start the auto-sync listener.
 * Syncs when the browser comes back online.
 */
export function startAutoSync(): void {
  if (typeof window === "undefined" || onlineListenerRegistered) return;

  window.addEventListener("online", () => {
    syncPendingMutations().catch(() => {
      /* fail-open */
    });
  });

  onlineListenerRegistered = true;

  // Sync immediately if we're already online and have pending mutations
  if (navigator.onLine) {
    getPendingMutationCount().then((count) => {
      if (count > 0) {
        syncPendingMutations().catch(() => {
          /* fail-open */
        });
      }
    });
  }
}

/* ── Custom Events ── */

type SyncEventType =
  | "mutation-queued"
  | "mutation-synced"
  | "sync-start"
  | "sync-progress"
  | "sync-complete";

function dispatchSyncEvent(type: SyncEventType, detail: unknown): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(`shiftfy:${type}`, { detail }));
}

export const syncEngine = {
  queueMutation,
  getPendingMutations,
  getPendingMutationCount,
  clearAllMutations,
  syncPendingMutations,
  startAutoSync,
  SYNC_TAG,
};
