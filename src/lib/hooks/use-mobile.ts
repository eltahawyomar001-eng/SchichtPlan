"use client";

import { useSyncExternalStore } from "react";

/** Mobile breakpoint — matches user spec for phone-compact views (768px). */
const MOBILE_BREAKPOINT = 768;

const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Returns `true` when viewport width ≤ 768px (phone-compact).
 *
 * SSR-safe: returns `false` on the server so hydration never
 * injects mobile-only DOM that the server didn't render.
 * Uses `useSyncExternalStore` for tear-free reads.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
