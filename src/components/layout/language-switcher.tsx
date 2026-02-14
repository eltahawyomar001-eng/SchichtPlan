"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/request";

const LOCALES: { value: Locale; flag: string; label: string }[] = [
  { value: "de", flag: "🇩🇪", label: "Deutsch" },
  { value: "en", flag: "🇬🇧", label: "English" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextLocale: Locale) {
    startTransition(async () => {
      await setLocale(nextLocale);
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map((l) => (
        <button
          key={l.value}
          onClick={() => handleChange(l.value)}
          disabled={isPending || locale === l.value}
          title={l.label}
          className={`rounded-md px-1.5 py-1 text-sm transition-colors ${
            locale === l.value
              ? "bg-violet-100 text-violet-700 font-medium"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          } ${isPending ? "opacity-50 cursor-wait" : ""}`}
        >
          {l.flag}
        </button>
      ))}
    </div>
  );
}
