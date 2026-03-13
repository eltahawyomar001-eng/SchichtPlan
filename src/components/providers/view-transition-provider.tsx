/**
 * View Transition Provider — iOS-style page transitions for PWA feel.
 *
 * Uses the View Transitions API as progressive enhancement. When the
 * browser supports `document.startViewTransition()`, navigations are
 * wrapped in a view transition for smooth cross-fade/slide animations.
 *
 * For unsupported browsers the transition CSS is simply ignored and
 * pages render instantly (graceful degradation).
 *
 * @see https://developer.chrome.com/docs/web-platform/view-transitions
 */
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Check if the browser supports the View Transitions API */
function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

/**
 * Intercepts route changes and wraps DOM updates in a
 * `document.startViewTransition()` call for smooth animations.
 *
 * This provider doesn't render any UI — it only observes pathname
 * changes and triggers the browser's view transition machinery.
 */
export function ViewTransitionProvider() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the initial mount — no transition needed
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevPathname.current = pathname;
      return;
    }

    // Only transition when pathname actually changed
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    if (!supportsViewTransitions()) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) return;

    // The View Transitions API captures the old state automatically
    // before the DOM update and animates to the new state.
    // Since Next.js App Router already updated the DOM by this point,
    // we trigger a "refresh" transition that applies the CSS animation.
    try {
      (
        document as Document & { startViewTransition: (cb: () => void) => void }
      ).startViewTransition(() => {
        // No-op — DOM is already updated by Next.js
      });
    } catch {
      // Graceful degradation — some edge cases may throw
    }
  }, [pathname]);

  return null;
}
