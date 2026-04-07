"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SyncResult } from "@/lib/offline/sync-engine";

/* ── Types ── */

type ConnectivityState = "online" | "offline" | "syncing" | "synced";

/* ── Helpers ── */

/**
 * Actually verify connectivity by hitting our health endpoint.
 * `navigator.onLine` is unreliable — it only checks for a local
 * network interface, not real internet connectivity. This pings
 * the server with a cache-busted HEAD request to confirm.
 */
async function checkRealConnectivity(): Promise<boolean> {
  try {
    const res = await fetch(`/api/health?_cb=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Component ── */

/**
 * Connectivity Banner
 *
 * Fixed banner that slides in from the top when the device goes offline
 * or when pending mutations are being synced. Auto-dismisses on success.
 *
 * States:
 * - **offline**: Red banner — "You are offline"
 * - **syncing**: Amber banner — "Syncing {n} changes…"
 * - **synced**: Green banner — "All changes synced" (auto-dismiss 3s)
 * - **online**: Hidden
 *
 * NOTE: We do NOT trust navigator.onLine alone — it is notoriously
 * unreliable on macOS, VPNs, and captive portals. Every offline
 * signal is verified with a real server ping before showing the banner.
 */
export function ConnectivityBanner() {
  const t = useTranslations("pwa");
  // Always start as "online" — we verify asynchronously if needed
  const [state, setState] = useState<ConnectivityState>("online");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyingRef = useRef(false);

  /** Clear any running dismiss timer */
  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  /** Start auto-dismiss after 3 seconds */
  const autoDismiss = useCallback(() => {
    clearDismissTimer();
    dismissTimer.current = setTimeout(() => {
      setState("online");
      setSyncProgress(null);
    }, 3_000);
  }, [clearDismissTimer]);

  /**
   * Verify connectivity before going offline.
   * Prevents false positives from navigator.onLine.
   */
  const verifyAndSetOffline = useCallback(async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    try {
      const isReachable = await checkRealConnectivity();
      if (!isReachable) {
        clearDismissTimer();
        setState("offline");
      }
    } finally {
      verifyingRef.current = false;
    }
  }, [clearDismissTimer]);

  useEffect(() => {
    const goOffline = () => {
      // Don't blindly trust the browser event — verify first
      verifyAndSetOffline();
    };

    const goOnline = () => {
      // Will transition to "syncing" if there are pending mutations
      // via the sync-start event. Otherwise just go online.
      setState("online");
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // On mount: if navigator.onLine is false, verify before showing banner
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      verifyAndSetOffline();
    }

    // Sync engine events
    const onMutationQueued = (e: Event) => {
      const { detail } = e as CustomEvent;
      if (detail) {
        setPendingCount((c) => c + 1);
      }
    };

    const onSyncStart = (e: Event) => {
      const { detail } = e as CustomEvent<{ total: number }>;
      if (detail?.total > 0) {
        setState("syncing");
        setSyncProgress({ completed: 0, total: detail.total });
      }
    };

    const onSyncProgress = (e: Event) => {
      const { detail } = e as CustomEvent<{
        total: number;
        completed: number;
      }>;
      if (detail) {
        setSyncProgress({
          completed: detail.completed,
          total: detail.total,
        });
      }
    };

    const onSyncComplete = (e: Event) => {
      const { detail } = e as CustomEvent<SyncResult>;
      if (detail) {
        setPendingCount(detail.failed);
        if (detail.failed === 0) {
          setState("synced");
          autoDismiss();
        } else {
          setState("online");
        }
      }
    };

    window.addEventListener("shiftfy:mutation-queued", onMutationQueued);
    window.addEventListener("shiftfy:sync-start", onSyncStart);
    window.addEventListener("shiftfy:sync-progress", onSyncProgress);
    window.addEventListener("shiftfy:sync-complete", onSyncComplete);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("shiftfy:mutation-queued", onMutationQueued);
      window.removeEventListener("shiftfy:sync-start", onSyncStart);
      window.removeEventListener("shiftfy:sync-progress", onSyncProgress);
      window.removeEventListener("shiftfy:sync-complete", onSyncComplete);
      clearDismissTimer();
    };
  }, [autoDismiss, clearDismissTimer]);

  // Don't render when online with nothing to report
  if (state === "online" && pendingCount === 0) return null;

  const isVisible = state !== "online";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999]",
        "transform transition-transform duration-300",
        "motion-reduce:transition-none",
        isVisible ? "translate-y-0" : "-translate-y-full",
        // safe area for notch
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-2.5",
          "text-sm font-medium text-white",
          state === "offline" && "bg-red-600",
          state === "syncing" && "bg-amber-600",
          state === "synced" && "bg-emerald-600",
        )}
      >
        {/* Icon */}
        <span className="shrink-0" aria-hidden="true">
          {state === "offline" && <OfflineIcon />}
          {state === "syncing" && <SyncingIcon />}
          {state === "synced" && <CheckIcon />}
        </span>

        {/* Message */}
        <span>
          {state === "offline" && t("connectivityOffline")}
          {state === "syncing" &&
            (syncProgress
              ? t("connectivitySyncing", {
                  completed: syncProgress.completed,
                  total: syncProgress.total,
                })
              : t("connectivitySyncingGeneric"))}
          {state === "synced" && t("connectivitySynced")}
        </span>

        {/* Pending count badge (offline) */}
        {state === "offline" && pendingCount > 0 && (
          <span className="ml-1 inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs">
            {t("connectivityPending", { count: pendingCount })}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Icons ── */

function OfflineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 1L15 15M3.05 6.05A7 7 0 0 1 8 4c1.57 0 3.01.52 4.17 1.39M5.64 8.64A4.5 4.5 0 0 1 8 8c.85 0 1.64.24 2.31.64M8 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SyncingIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="animate-spin"
    >
      <path
        d="M8 1v3M8 12v3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M1 8h3M12 8h3M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
