"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/i18n/locale";
import { DEFlagIcon, GBFlagIcon } from "@/components/icons";
import type { Locale } from "@/i18n/request";

const LOCALES: {
  value: Locale;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  short: string;
}[] = [
  { value: "de", icon: DEFlagIcon, label: "Deutsch", short: "DE" },
  { value: "en", icon: GBFlagIcon, label: "English", short: "EN" },
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
      className={`inline-flex items-center rounded-full border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 p-0.5 ${isPending ? "opacity-50 pointer-events-none" : ""}`}
    >
      {LOCALES.map((l) => {
        const isActive = locale === l.value;
        return (
          <button
            key={l.value}
            onClick={() => handleChange(l.value)}
            disabled={isPending}
            title={l.label}
            className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
              isActive
                ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm ring-1 ring-gray-200 dark:ring-zinc-600"
                : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            }`}
          >
            <l.icon className="h-3.5 w-[18px] flex-shrink-0" />
            <span className="hidden sm:inline">{l.short}</span>
          </button>
        );
      })}
    </div>
  );
}
