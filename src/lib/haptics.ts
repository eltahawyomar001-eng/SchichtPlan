/**
 * Haptics — Vibration API wrapper for native-feel feedback.
 *
 * Provides three feedback intensities that map to common UI interactions.
 * Falls back silently on devices without vibration support.
 *
 * Usage:
 *   import { haptics } from "@/lib/haptics";
 *   haptics.light();    // tab switch, toggle
 *   haptics.medium();   // button press, selection
 *   haptics.heavy();    // destructive action, error
 *   haptics.success();  // successful action (double tap)
 */

type HapticPattern = number | number[];

/** Check if the Vibration API is available */
function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/** Check if user prefers reduced motion */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function vibrate(pattern: HapticPattern): void {
  if (!canVibrate() || prefersReducedMotion()) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail — some browsers throw on vibrate
  }
}

/** Light feedback — tab switch, toggle, minor selection */
function light(): void {
  vibrate(10);
}

/** Medium feedback — button press, confirmed selection */
function medium(): void {
  vibrate(20);
}

/** Heavy feedback — destructive action, error state */
function heavy(): void {
  vibrate(40);
}

/** Success pattern — double tap for confirmed completion */
function success(): void {
  vibrate([15, 50, 15]);
}

/** Error pattern — longer single buzz */
function error(): void {
  vibrate([50, 30, 50]);
}

export const haptics = {
  light,
  medium,
  heavy,
  success,
  error,
  canVibrate,
};
