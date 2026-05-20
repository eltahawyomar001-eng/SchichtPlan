"use client";

import { useSyncExternalStore, useState } from "react";
import { XIcon } from "@/components/icons";

const STORAGE_KEY = "shiftfy-sos-discovered-v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function SosDiscoveryBanner() {
  const storedFlag = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(STORAGE_KEY),
    () => "1", // SSR snapshot: assume dismissed so server HTML hides it
  );
  const [dismissed, setDismissed] = useState(false);
  const visible = storedFlag === null && !dismissed;

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm">
      <span className="text-xl leading-none mt-0.5" aria-hidden>
        🚨
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-700 dark:text-red-400">
          Neu: SOS Notfall-Besetzung
        </p>
        <p className="text-red-600/80 dark:text-red-400/70 mt-0.5">
          Schicht kurzfristig unbesetzt? Klick auf das{" "}
          <span className="inline-flex items-center gap-1 font-medium">
            🚨 rote Symbol
          </span>{" "}
          auf einer Schichtkarte — Shiftfy benachrichtigt sofort alle
          verfügbaren Mitarbeiter und besetzt die Schicht automatisch.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Banner schließen"
        className="shrink-0 rounded p-1 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
