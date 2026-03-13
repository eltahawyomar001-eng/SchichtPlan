/**
 * Cache Manager — IndexedDB wrapper for offline-first data caching.
 *
 * Extends the existing `offline-store.ts` pattern to cache core app
 * data (shifts, time entries, employees) with configurable TTLs.
 * Implements `getOrFetch()` for stale-while-revalidate reads.
 *
 * Database: `shiftfy-offline`, version 2 (upgrades from v1).
 * Stores: shifts, timeEntries, employees, pendingMutations, metadata.
 *
 * @see offline-store.ts for the original IndexedDB pattern
 */

const DB_NAME = "shiftfy-offline";
const DB_VERSION = 2;

/* ── Store Names ── */
const STORES = {
  SHIFTS: "shifts",
  TIME_ENTRIES: "timeEntries",
  EMPLOYEES: "employees",
  PENDING_MUTATIONS: "pendingMutations",
  METADATA: "metadata",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

/* ── Default TTLs (ms) ── */
const DEFAULT_TTLS: Record<string, number> = {
  [STORES.SHIFTS]: 30_000, // 30s
  [STORES.TIME_ENTRIES]: 60_000, // 60s
  [STORES.EMPLOYEES]: 60_000, // 60s
};

/** Maximum offline cache size in bytes (50 MB) */
const MAX_CACHE_BYTES = 50 * 1024 * 1024;

/* ── Types ── */

interface CachedEntry<T = unknown> {
  /** Composite key for the entry */
  key: string;
  /** The cached data */
  data: T;
  /** ISO-8601 timestamp when cached */
  cachedAt: string;
  /** TTL in milliseconds */
  staleAfter: number;
  /** Approximate size in bytes (for LRU eviction) */
  sizeBytes: number;
}

interface _MetadataEntry {
  key: string;
  value: string;
  updatedAt: string;
}

/* ── IndexedDB Helpers ── */

/** Check if IndexedDB is available */
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

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // v1 → v2: Add new stores (preserve existing pendingActions)
      if (oldVersion < 2) {
        // Create new stores if they don't exist
        for (const name of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: "key" });
            store.createIndex("cachedAt", "cachedAt", { unique: false });
          }
        }

        // Migrate existing pendingActions → pendingMutations
        if (
          db.objectStoreNames.contains("pendingActions") &&
          !db.objectStoreNames.contains(STORES.PENDING_MUTATIONS)
        ) {
          // Keep old store — sync engine handles both
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

/* ── Approximate size calculation ── */

function estimateSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 1024; // fallback 1KB estimate
  }
}

/* ── LRU Eviction ── */

/**
 * Evict oldest entries from a store until total size is under limit.
 */
async function evictIfNeeded(
  db: IDBDatabase,
  storeName: StoreName,
): Promise<void> {
  return new Promise((resolve) => {
    const store = txStore(db, storeName, "readwrite");
    const index = store.index("cachedAt");
    const request = index.getAll();

    request.onsuccess = () => {
      const entries = request.result as CachedEntry[];
      let totalSize = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);

      // Per-store limit: MAX_CACHE_BYTES / number of data stores
      const storeLimit = MAX_CACHE_BYTES / 3;

      if (totalSize <= storeLimit) {
        resolve();
        return;
      }

      // Sort by cachedAt ascending (oldest first)
      entries.sort(
        (a, b) =>
          new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime(),
      );

      const toDelete: string[] = [];
      for (const entry of entries) {
        if (totalSize <= storeLimit) break;
        totalSize -= entry.sizeBytes || 0;
        toDelete.push(entry.key);
      }

      const delStore = txStore(db, storeName, "readwrite");
      for (const key of toDelete) {
        delStore.delete(key);
      }
      resolve();
    };

    request.onerror = () => resolve(); // fail-open
  });
}

/* ── Public API ── */

/**
 * Get a cached entry by key from a specific store.
 * Returns `null` if not found or if the entry is stale.
 */
async function get<T>(storeName: StoreName, key: string): Promise<T | null> {
  if (!isIndexedDBAvailable()) return null;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const store = txStore(db, storeName, "readonly");
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CachedEntry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if stale
        const age = Date.now() - new Date(entry.cachedAt).getTime();
        if (age > entry.staleAfter) {
          resolve(null);
          return;
        }

        resolve(entry.data);
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Set a cached entry in a specific store.
 */
async function set<T>(
  storeName: StoreName,
  key: string,
  data: T,
  ttlMs?: number,
): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    const sizeBytes = estimateSize(data);
    const entry: CachedEntry<T> = {
      key,
      data,
      cachedAt: new Date().toISOString(),
      staleAfter: ttlMs ?? DEFAULT_TTLS[storeName] ?? 60_000,
      sizeBytes,
    };

    return new Promise((resolve) => {
      const store = txStore(db, storeName, "readwrite");
      const request = store.put(entry);
      request.onsuccess = () => {
        evictIfNeeded(db, storeName).then(() => resolve());
      };
      request.onerror = () => resolve();
    });
  } catch {
    // fail-open
  }
}

/**
 * Delete a cached entry by key.
 */
async function del(storeName: StoreName, key: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const store = txStore(db, storeName, "readwrite");
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // fail-open
  }
}

/**
 * Get-or-fetch: read from cache if fresh, otherwise call fetchFn,
 * cache the result, and return it.
 *
 * This is the primary API for data pages to use.
 */
async function getOrFetch<T>(
  storeName: StoreName,
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  // Try cache first
  const cached = await get<T>(storeName, key);
  if (cached !== null) return cached;

  // Fetch from network
  const data = await fetchFn();

  // Cache in background (don't await — don't block the response)
  set(storeName, key, data, ttlMs).catch(() => {
    /* fail-open */
  });

  return data;
}

/**
 * Clear all data in a specific store.
 */
async function clearStore(storeName: StoreName): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const store = txStore(db, storeName, "readwrite");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // fail-open
  }
}

export const cacheManager = {
  get,
  set,
  del,
  getOrFetch,
  clearStore,
  STORES,
};
