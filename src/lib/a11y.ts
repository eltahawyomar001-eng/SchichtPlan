/* ═══════════════════════════════════════════════════════════════
   Accessibility utilities (WCAG 2.1 AA / BFSG)
   ═══════════════════════════════════════════════════════════════
   Reusable hooks and helpers for keyboard navigation,
   focus management, and screen reader support.

   Usage:
     import { useFocusTrap, useArrowNavigation, srOnly } from "@/lib/a11y";
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useCallback } from "react";

/** Focusable element selector (WCAG) */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';

/**
 * Trap focus within a container (e.g. modal, dialog, drawer).
 * When the container is mounted, focus is moved to the first
 * focusable element. Tab/Shift+Tab cycle within the container.
 *
 * @param active - Whether the trap is active
 * @returns A ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus first element on mount
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return containerRef;
}

/**
 * Arrow-key navigation within a list of items (e.g. menu, listbox).
 * Handles Up/Down arrows and Home/End keys.
 *
 * @param selector - CSS selector for navigable items within the container
 * @returns A ref to attach to the container element
 */
export function useArrowNavigation<T extends HTMLElement>(
  selector: string = '[role="menuitem"], [role="option"], li > a, li > button',
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      const items = Array.from(
        container!.querySelectorAll<HTMLElement>(selector),
      );
      const current = document.activeElement as HTMLElement;
      const index = items.indexOf(current);

      let next: number | null = null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          next = index < items.length - 1 ? index + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          next = index > 0 ? index - 1 : items.length - 1;
          break;
        case "Home":
          e.preventDefault();
          next = 0;
          break;
        case "End":
          e.preventDefault();
          next = items.length - 1;
          break;
      }

      if (next !== null && items[next]) {
        items[next].focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [selector]);

  return containerRef;
}

/**
 * Announce a message to screen readers via a live region.
 */
export function useAnnounce() {
  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      const el = document.createElement("div");
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", priority);
      el.setAttribute("aria-atomic", "true");
      el.className = "sr-only";
      el.textContent = message;
      document.body.appendChild(el);

      // Remove after screen reader has time to read it
      setTimeout(() => el.remove(), 1000);
    },
    [],
  );

  return announce;
}

/**
 * Generate a unique ID for linking labels to inputs.
 * Uses React 18+ useId pattern.
 */
let counter = 0;
export function generateA11yId(prefix = "a11y"): string {
  return `${prefix}-${++counter}`;
}
