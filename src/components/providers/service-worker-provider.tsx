"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount.
 * Without this, push notifications and offline support don't work
 * because `navigator.serviceWorker.ready` never resolves.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates every 60 minutes
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });
  }, []);

  return null;
}
