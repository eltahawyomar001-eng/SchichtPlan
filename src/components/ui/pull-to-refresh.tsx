"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/* ── Constants ── */

/** Distance the user must pull (px) before the refresh triggers */
const TRIGGER_DISTANCE = 80;
/** Maximum overscroll distance to prevent extreme pull */
const MAX_DISTANCE = 120;
/** Minimum Y position — only trigger when at the top of the page */
const SCROLL_THRESHOLD = 5;

type PullState = "idle" | "pulling" | "ready" | "refreshing";

/**
 * Pull-to-Refresh
 *
 * Native-feel pull-to-refresh for PWA standalone mode.
 * Only activates when the user is at the top of the page and pulls down.
 *
 * Renders an indicator at the top of the viewport and uses
 * `router.refresh()` to reload server components.
 *
 * Respects `prefers-reduced-motion`: disables the elastic animation.
 */
export function PullToRefresh() {
  const t = useTranslations("pwa");
  const router = useRouter();
  const [state, setState] = useState<PullState>("idle");
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      // Only activate at the top of the page
      if (window.scrollY > SCROLL_THRESHOLD) return;
      if (state === "refreshing") return;

      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    },
    [state],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current) return;
      if (state === "refreshing") return;

      currentY.current = e.touches[0].clientY;
      const delta = currentY.current - startY.current;

      // Only handle downward pulls
      if (delta <= 0) {
        setPullDistance(0);
        setState("idle");
        return;
      }

      // Dampen the pull distance for a rubbery feel
      const dampened = Math.min(delta * 0.5, MAX_DISTANCE);
      setPullDistance(dampened);

      if (dampened >= TRIGGER_DISTANCE) {
        setState("ready");
      } else {
        setState("pulling");
      }

      // Prevent page scroll while pulling
      if (window.scrollY <= SCROLL_THRESHOLD && delta > 0) {
        e.preventDefault();
      }
    },
    [state],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (state === "ready") {
      setState("refreshing");
      setPullDistance(TRIGGER_DISTANCE * 0.5); // Snap to smaller height during refresh

      // Perform the refresh
      router.refresh();

      // Reset after a short delay
      setTimeout(() => {
        setState("idle");
        setPullDistance(0);
      }, 1_500);
    } else {
      setState("idle");
      setPullDistance(0);
    }
  }, [state, router]);

  useEffect(() => {
    // Only activate in PWA standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone: boolean }).standalone);

    if (!isStandalone) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (state === "idle" && pullDistance === 0) return null;

  const rotation = Math.min((pullDistance / TRIGGER_DISTANCE) * 360, 360);

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9997]",
        "flex items-center justify-center",
        "pt-[env(safe-area-inset-top)]",
        "pointer-events-none",
        "transition-[height] duration-200",
        "motion-reduce:transition-none",
      )}
      style={{ height: `${pullDistance}px` }}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-1",
          "transition-opacity duration-200",
          pullDistance > 10 ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Spinner / Arrow */}
        {state === "refreshing" ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="animate-spin text-emerald-600"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="31.4 31.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className={cn(
              "text-gray-500 transition-transform duration-200",
              state === "ready" && "text-emerald-600",
            )}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <path
              d="M12 4v12M12 4l-4 4M12 4l4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: state === "ready" ? "scaleY(-1)" : undefined,
                transformOrigin: "center",
              }}
            />
          </svg>
        )}

        {/* Text */}
        <span className="text-xs text-gray-500">
          {state === "pulling" && t("pullToRefresh")}
          {state === "ready" && t("releaseToRefresh")}
          {state === "refreshing" && t("refreshing")}
        </span>
      </div>
    </div>
  );
}
