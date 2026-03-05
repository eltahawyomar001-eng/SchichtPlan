/**
 * Offline Store — IndexedDB wrapper for service visit actions.
 *
 * Queues check-in, check-out, and signature actions when the device
 * is offline. Syncs them to the server when connectivity is restored.
 *
 * Uses the "idb" pattern without external dependencies — raw IndexedDB
 * wrapped in Promises for clean async/await usage.
 */

const DB_NAME = "shiftfy-offline";
const DB_VERSION = 1;
const STORE_NAME = "pendingActions";

// ─── Types ──────────────────────────────────────────────────────

export type OfflineActionType = "CHECK_IN" | "CHECK_OUT" | "SIGNATURE";

export interface OfflineAction {
  /** Auto-increment key set by IndexedDB */
  id?: number;
  /** Action type determines the API endpoint */
  type: OfflineActionType;
  /** The service visit ID this action relates to */
  visitId: string;
  /** Full request payload (lat, lng, signatureData, etc.) */
  payload: Record<string, unknown>;
  /** ISO-8601 timestamp when the action was queued */
  queuedAt: string;
  /** Device UUID (from localStorage) */
  deviceId: string;
  /** Number of sync attempts so far */
  retryCount: number;
  /** Last error message if sync failed */
  lastError?: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{ actionId: number; error: string }>;
}

// ─── IndexedDB Helpers ──────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("visitId", "visitId", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("queuedAt", "queuedAt", { unique: false });
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

// ─── Public API ─────────────────────────────────────────────────

/**
 * Queue an offline action for later sync.
 */
export async function queueAction(
  action: Omit<OfflineAction, "id" | "retryCount" | "queuedAt">,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const entry: Omit<OfflineAction, "id"> = {
      ...action,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };
    const request = store.add(entry);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending (un-synced) actions, ordered by queuedAt.
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readonly");
    const index = store.index("queuedAt");
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the count of pending actions.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readonly");
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a successfully synced action from the queue.
 */
export async function removeAction(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update an action after a failed sync attempt.
 */
export async function markRetry(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const action = getReq.result as OfflineAction;
      if (!action) {
        resolve();
        return;
      }
      action.retryCount += 1;
      action.lastError = error;
      const putReq = store.put(action);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Clear all pending actions (e.g. after logout).
 */
export async function clearAllActions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── Sync Engine ────────────────────────────────────────────────

const ACTION_ENDPOINTS: Record<OfflineActionType, (visitId: string) => string> =
  {
    CHECK_IN: (id) => `/api/service-visits/${id}/check-in`,
    CHECK_OUT: (id) => `/api/service-visits/${id}/check-out`,
    SIGNATURE: (id) => `/api/service-visits/${id}/signature`,
  };

const MAX_RETRIES = 5;

/**
 * Sync all pending actions to the server.
 * Actions are processed in FIFO order. Each action is sent as a POST
 * request. On success the action is removed; on failure it's marked
 * for retry (up to MAX_RETRIES).
 *
 * Returns a summary of what was synced and what failed.
 */
export async function syncPendingActions(): Promise<SyncResult> {
  const actions = await getPendingActions();
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  for (const action of actions) {
    if (action.retryCount >= MAX_RETRIES) {
      // Skip permanently failed actions
      result.failed++;
      result.errors.push({
        actionId: action.id!,
        error: `Max retries (${MAX_RETRIES}) exceeded: ${action.lastError}`,
      });
      continue;
    }

    const endpoint = ACTION_ENDPOINTS[action.type](action.visitId);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...action.payload,
          // Mark as offline-synced so server audit knows
          deviceId: action.deviceId,
          clientTimestamp: action.queuedAt,
        }),
      });

      if (response.ok) {
        await removeAction(action.id!);
        result.synced++;
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        await markRetry(action.id!, `HTTP ${response.status}: ${errorText}`);
        result.failed++;
        result.errors.push({
          actionId: action.id!,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      await markRetry(action.id!, message);
      result.failed++;
      result.errors.push({ actionId: action.id!, error: message });
    }
  }

  return result;
}

// ─── Device ID ──────────────────────────────────────────────────

const DEVICE_ID_KEY = "shiftfy-device-id";

/**
 * Get or create a persistent device UUID.
 * Stored in localStorage so it survives page reloads.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
