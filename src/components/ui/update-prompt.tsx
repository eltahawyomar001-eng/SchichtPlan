"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface UpdateWb {
  messageSkipWaiting: () => void;
}

/**
 * Update-Available Prompt
 *
 * Slides in from the bottom when a new service worker is waiting.
 * User can "Update now" (triggers SKIP_WAITING → reload) or dismiss.
 *
 * Listens for the 'shiftfy:sw-update-available' custom event
 * dispatched by ServiceWorkerProvider.
 */
export function UpdatePrompt() {
  const t = useTranslations("pwa");
  const [wb, setWb] = useState<UpdateWb | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{ wb: UpdateWb }>;
      if (detail?.wb) {
        setWb(detail.wb);
        setDismissed(false);
      }
    };

    window.addEventListener("shiftfy:sw-update-available", handler);
    return () => {
      window.removeEventListener("shiftfy:sw-update-available", handler);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (wb) {
      wb.messageSkipWaiting();
      // Page will reload when the new SW takes control (via "controlling" event)
    }
  }, [wb]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!wb || dismissed) return null;

  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-20 left-4 right-4 z-[9998]",
        "mx-auto max-w-sm",
        // safe area for bottom nav
        "mb-[env(safe-area-inset-bottom)]",
        // slide-up animation
        "animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]",
        "motion-reduce:animate-none",
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-gray-900 p-4 shadow-2xl",
          "dark:bg-gray-800",
          "flex flex-col gap-3",
        )}
      >
        {/* Title & description */}
        <div>
          <p className="text-sm font-semibold text-white">
            {t("updateAvailableTitle")}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {t("updateAvailableDesc")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className={cn(
              "flex-1 rounded-xl px-4 py-2",
              "text-sm font-medium text-gray-400",
              "bg-gray-800 dark:bg-gray-700",
              "transition-colors active:bg-gray-700",
            )}
          >
            {t("updateDismiss")}
          </button>
          <button
            onClick={handleUpdate}
            className={cn(
              "flex-1 rounded-xl px-4 py-2",
              "text-sm font-semibold text-white",
              "bg-emerald-600",
              "transition-colors active:bg-emerald-700",
            )}
          >
            {t("updateNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
