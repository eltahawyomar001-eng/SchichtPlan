"use client";

import { useTransition, type ComponentType, type SVGProps } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/i18n/locale";
import { DEFlagIcon, GBFlagIcon } from "@/components/icons";
import type { Locale } from "@/i18n/request";

const LOCALES: {
  value: Locale;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}[] = [
  { value: "de", icon: DEFlagIcon, label: "Deutsch" },
  { value: "en", icon: GBFlagIcon, label: "English" },
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
          className={`rounded-lg p-1.5 transition-all ${
            locale === l.value
              ? "bg-violet-50 ring-1 ring-violet-200 shadow-sm"
              : "opacity-50 hover:opacity-100 hover:bg-gray-100"
          } ${isPending ? "opacity-30 cursor-wait" : ""}`}
        >
          <l.icon className="h-4 w-5" />
        </button>
      ))}
    </div>
  );
}
