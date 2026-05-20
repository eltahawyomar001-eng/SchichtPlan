"use client";

import { useSyncExternalStore, useState } from "react";
import { useTranslations } from "next-intl";
import { XIcon, AlertCircleIcon } from "@/components/icons";

const STORAGE_KEY = "shiftfy-sos-discovered-v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function SosDiscoveryBanner() {
  const t = useTranslations("shiftPlan");
  const storedFlag = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(STORAGE_KEY),
    () => "1",
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
      <AlertCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-700 dark:text-red-400">
          {t("sosBannerTitle")}
        </p>
        <p className="text-red-600/80 dark:text-red-400/70 mt-0.5">
          {t("sosBannerDesc")}
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label={t("sosBannerDismiss")}
        className="shrink-0 rounded p-1 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
