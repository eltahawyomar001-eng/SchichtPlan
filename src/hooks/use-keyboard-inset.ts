"use client";

import { useEffect, useState } from "react";

/**
 * Returns the height of the on-screen software keyboard in pixels.
 * Uses the visualViewport API so it works correctly on iOS Safari.
 * Returns 0 when no keyboard is visible or the API is unavailable.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(keyboardHeight)));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
