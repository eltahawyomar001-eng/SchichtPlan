"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/request";

const LOCALES: { value: Locale; short: string; label: string }[] = [
  { value: "de", short: "DE", label: "Deutsch" },
  { value: "en", short: "EN", label: "English" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, setIsPending] = useState(false);

  async function handleChange(nextLocale: Locale) {
    if (nextLocale === locale || isPending) return;
    setIsPending(true);
    try {
      await setLocale(nextLocale);
    } catch {
      // Cookie may still have been set — reload anyway
    }
    // Always reload regardless of server action success/failure
    window.location.reload();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800/60 ${
        isPending ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {LOCALES.map((l) => {
        const isActive = locale === l.value;
        return (
          <button
            key={l.value}
            type="button"
            onClick={() => handleChange(l.value)}
            disabled={isPending}
            aria-pressed={isActive}
            title={l.label}
            className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wide transition-colors duration-200 ${
              isActive
                ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
            }`}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}
