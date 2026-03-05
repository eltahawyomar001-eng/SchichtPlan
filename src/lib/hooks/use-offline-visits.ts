"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  queueAction,
  syncPendingActions,
  getPendingCount,
  getDeviceId,
  type OfflineActionType,
  type SyncResult,
} from "@/lib/offline-store";

// ─── Types ──────────────────────────────────────────────────────

interface UseOfflineVisitsReturn {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Number of actions waiting to be synced */
  pendingCount: number;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Result of the last sync attempt */
  lastSyncResult: SyncResult | null;
  /**
   * Execute a visit action (check-in, check-out, signature).
   * - Online: sends directly to the API, falls back to queue on failure.
   * - Offline: queues immediately for later sync.
   *
   * Returns the API response data if online+successful, or `null` if queued.
   */
  executeAction: (
    type: OfflineActionType,
    visitId: string,
    payload: Record<string, unknown>,
  ) => Promise<{ data: unknown; queued: boolean }>;
  /** Manually trigger a sync of all pending actions */
  syncNow: () => Promise<SyncResult>;
}

// ─── Endpoint Map ───────────────────────────────────────────────

const ENDPOINTS: Record<OfflineActionType, (id: string) => string> = {
  CHECK_IN: (id) => `/api/service-visits/${id}/check-in`,
  CHECK_OUT: (id) => `/api/service-visits/${id}/check-out`,
  SIGNATURE: (id) => `/api/service-visits/${id}/signature`,
};

// ─── Hook ───────────────────────────────────────────────────────

export function useOfflineVisits(): UseOfflineVisitsReturn {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncLockRef = useRef(false);

  // ── Track online/offline ──
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Refresh pending count ──
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB not available (SSR, private browsing)
    }
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // ── Sync engine ──
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (syncLockRef.current) {
      return { synced: 0, failed: 0, errors: [] };
    }

    syncLockRef.current = true;
    setIsSyncing(true);

    try {
      const result = await syncPendingActions();
      setLastSyncResult(result);
      await refreshCount();
      return result;
    } finally {
      setIsSyncing(false);
      syncLockRef.current = false;
    }
  }, [refreshCount]);

  // ── Auto-sync when coming back online ──
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncLockRef.current) {
      // Small delay to let network stabilize
      const timer = setTimeout(() => {
        syncNow();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, syncNow]);

  // ── Execute action (online-first with offline fallback) ──
  const executeAction = useCallback(
    async (
      type: OfflineActionType,
      visitId: string,
      payload: Record<string, unknown>,
    ): Promise<{ data: unknown; queued: boolean }> => {
      const deviceId = getDeviceId();
      const enrichedPayload = {
        ...payload,
        deviceId,
        clientTimestamp: new Date().toISOString(),
      };

      // If offline, queue immediately
      if (!navigator.onLine) {
        await queueAction({
          type,
          visitId,
          payload: enrichedPayload,
          deviceId,
        });
        await refreshCount();
        return { data: null, queued: true };
      }

      // Online: try direct API call
      const endpoint = ENDPOINTS[type](visitId);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(enrichedPayload),
        });

        if (response.ok) {
          const data = await response.json();
          return { data, queued: false };
        }

        // Server error but we're online — if it's a network-level
        // issue (502, 503, 504), queue for retry
        if (response.status >= 500) {
          await queueAction({
            type,
            visitId,
            payload: enrichedPayload,
            deviceId,
          });
          await refreshCount();
          return { data: null, queued: true };
        }

        // Client error (400, 403, 404, 409) — don't queue, throw
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}`,
        }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      } catch (error) {
        // Network failure — queue for later
        if (error instanceof TypeError && error.message.includes("fetch")) {
          await queueAction({
            type,
            visitId,
            payload: enrichedPayload,
            deviceId,
          });
          await refreshCount();
          return { data: null, queued: true };
        }
        throw error;
      }
    },
    [refreshCount],
  );

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    executeAction,
    syncNow,
  };
}
