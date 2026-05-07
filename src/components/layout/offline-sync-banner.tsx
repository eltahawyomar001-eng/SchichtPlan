"use client";

import { useEffect, useState } from "react";

export function OfflineSyncBanner() {
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const handler = () => setFailedCount((n) => n + 1);
    window.addEventListener("sync-failed-permanent", handler);
    return () => window.removeEventListener("sync-failed-permanent", handler);
  }, []);

  if (failedCount === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium bg-red-600 text-white"
    >
      <span>
        {failedCount === 1
          ? "1 Offline-Aktion konnte nicht gespeichert werden."
          : `${failedCount} Offline-Aktionen konnten nicht gespeichert werden.`}{" "}
        Bitte Internetverbindung prüfen und die Seite neu laden.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex-shrink-0 rounded px-2 py-0.5 text-xs font-semibold border border-white/40 hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Neu laden
      </button>
    </div>
  );
}
