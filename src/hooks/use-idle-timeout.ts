"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes — DSGVO Art. 32 session hygiene
const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "pointerdown",
] as const;

/**
 * Signs the user out after 15 minutes of inactivity.
 * Attach once in the top-level dashboard client component.
 */
export function useIdleTimeout() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => signOut({ callbackUrl: "/login" }),
        IDLE_MS,
      );
    };

    reset();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, []);
}
