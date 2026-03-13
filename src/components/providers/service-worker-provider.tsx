"use client";

import { useEffect, useCallback } from "react";

/**
 * Registers the service worker and handles:
 * - Update detection (dispatches 'shiftfy:sw-update-available' event)
 * - Background Sync messages from the SW
 * - Periodic update checks every 60 minutes
 *
 * Uses workbox-window for robust update lifecycle handling.
 */
export function ServiceWorkerProvider() {
  const handleSWMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "SYNC_PENDING_MUTATIONS") {
      // Lazy-import sync engine to avoid bundling it in the initial load
      import("@/lib/offline/sync-engine").then(({ syncPendingMutations }) => {
        syncPendingMutations().catch(() => {
          /* fail-open */
        });
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null | undefined = null;

    async function registerSW() {
      try {
        // Use workbox-window for robust lifecycle handling
        const { Workbox } = await import("workbox-window");

        const wb = new Workbox("/sw.js");

        // When a new SW is waiting, notify the UI
        wb.addEventListener("waiting", () => {
          window.dispatchEvent(
            new CustomEvent("shiftfy:sw-update-available", {
              detail: { wb },
            }),
          );
        });

        // When the new SW takes over, reload the page
        wb.addEventListener("controlling", () => {
          window.location.reload();
        });

        registration = await wb.register();

        // Check for updates every 60 minutes
        setInterval(
          () => {
            registration?.update();
          },
          60 * 60 * 1000,
        );
      } catch (err) {
        // Fallback to raw registration if workbox-window fails
        console.error("[SW] Workbox registration failed, using fallback:", err);
        try {
          registration = await navigator.serviceWorker.register("/sw.js");
          setInterval(() => registration?.update(), 60 * 60 * 1000);
        } catch (fallbackErr) {
          console.error("[SW] Fallback registration also failed:", fallbackErr);
        }
      }
    }

    registerSW();

    // Listen for sync messages from the SW
    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    };
  }, [handleSWMessage]);

  return null;
}
