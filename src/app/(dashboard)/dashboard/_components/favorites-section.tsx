"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CalendarIcon,
  ClockIcon,
  CalendarOffIcon,
  SwapIcon,
  TargetIcon,
  FileCheckIcon,
  MessageCircleIcon,
  TicketIcon,
  CalendarUsersIcon,
  CalendarRangeIcon,
  UsersIcon,
  LayersIcon,
  AwardIcon,
  MapPinIcon,
  TemplateIcon,
  FolderIcon,
  PalmtreeIcon,
  ScaleIcon,
  BarChartIcon,
  FileExportIcon,
  ArchiveIcon,
  DatabaseIcon,
  FlagIcon,
  ZapIcon,
  LinkIcon,
  SettingsIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  StarIcon,
  PlusIcon,
  XIcon,
  CheckCircleIcon,
} from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ── Page registry: key → icon + href + color ── */
interface PageInfo {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  bg: string;
  hoverBorder: string;
  hoverBg: string;
}

const PAGE_REGISTRY: Record<string, PageInfo> = {
  shiftPlan: {
    icon: CalendarIcon,
    href: "/schichtplan",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/50",
    hoverBorder: "hover:border-emerald-200 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30",
  },
  timeTracking: {
    icon: ClockIcon,
    href: "/zeiterfassung",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50",
    hoverBorder: "hover:border-blue-200 dark:hover:border-blue-700",
    hoverBg: "hover:bg-blue-50/30 dark:hover:bg-blue-900/30",
  },
  absences: {
    icon: CalendarOffIcon,
    href: "/abwesenheiten",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/50 dark:to-orange-800/50",
    hoverBorder: "hover:border-orange-200 dark:hover:border-orange-700",
    hoverBg: "hover:bg-orange-50/30 dark:hover:bg-orange-900/30",
  },
  shiftSwap: {
    icon: SwapIcon,
    href: "/schichttausch",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/50",
    hoverBorder: "hover:border-emerald-200 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30",
  },
  punchClock: {
    icon: TargetIcon,
    href: "/stempeluhr",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/50 dark:to-rose-800/50",
    hoverBorder: "hover:border-rose-200 dark:hover:border-rose-700",
    hoverBg: "hover:bg-rose-50/30 dark:hover:bg-rose-900/30",
  },
  serviceProof: {
    icon: FileCheckIcon,
    href: "/leistungsnachweis",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/50 dark:to-teal-800/50",
    hoverBorder: "hover:border-teal-200 dark:hover:border-teal-700",
    hoverBg: "hover:bg-teal-50/30 dark:hover:bg-teal-900/30",
  },
  teamChat: {
    icon: MessageCircleIcon,
    href: "/nachrichten",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/50 dark:to-violet-800/50",
    hoverBorder: "hover:border-violet-200 dark:hover:border-violet-700",
    hoverBg: "hover:bg-violet-50/30 dark:hover:bg-violet-900/30",
  },
  tickets: {
    icon: TicketIcon,
    href: "/tickets",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/50 dark:to-amber-800/50",
    hoverBorder: "hover:border-amber-200 dark:hover:border-amber-700",
    hoverBg: "hover:bg-amber-50/30 dark:hover:bg-amber-900/30",
  },
  teamCalendar: {
    icon: CalendarUsersIcon,
    href: "/teamkalender",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/50 dark:to-indigo-800/50",
    hoverBorder: "hover:border-indigo-200 dark:hover:border-indigo-700",
    hoverBg: "hover:bg-indigo-50/30 dark:hover:bg-indigo-900/30",
  },
  annualPlanning: {
    icon: CalendarRangeIcon,
    href: "/jahresplanung",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/50 dark:to-cyan-800/50",
    hoverBorder: "hover:border-cyan-200 dark:hover:border-cyan-700",
    hoverBg: "hover:bg-cyan-50/30 dark:hover:bg-cyan-900/30",
  },
  employees: {
    icon: UsersIcon,
    href: "/mitarbeiter",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/50",
    hoverBorder: "hover:border-emerald-200 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30",
  },
  departments: {
    icon: LayersIcon,
    href: "/abteilungen",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50",
    hoverBorder: "hover:border-purple-200 dark:hover:border-purple-700",
    hoverBg: "hover:bg-purple-50/30 dark:hover:bg-purple-900/30",
  },
  skills: {
    icon: AwardIcon,
    href: "/qualifikationen",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/50 dark:to-yellow-800/50",
    hoverBorder: "hover:border-yellow-200 dark:hover:border-yellow-700",
    hoverBg: "hover:bg-yellow-50/30 dark:hover:bg-yellow-900/30",
  },
  locations: {
    icon: MapPinIcon,
    href: "/standorte",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50",
    hoverBorder: "hover:border-blue-200 dark:hover:border-blue-700",
    hoverBg: "hover:bg-blue-50/30 dark:hover:bg-blue-900/30",
  },
  shiftTemplates: {
    icon: TemplateIcon,
    href: "/schichtvorlagen",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50",
    hoverBorder: "hover:border-slate-200 dark:hover:border-slate-600",
    hoverBg: "hover:bg-slate-50/30 dark:hover:bg-slate-900/30",
  },
  projects: {
    icon: FolderIcon,
    href: "/projekte",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/50 dark:to-amber-800/50",
    hoverBorder: "hover:border-amber-200 dark:hover:border-amber-700",
    hoverBg: "hover:bg-amber-50/30 dark:hover:bg-amber-900/30",
  },
  clients: {
    icon: UsersIcon,
    href: "/kunden",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/50 dark:to-sky-800/50",
    hoverBorder: "hover:border-sky-200 dark:hover:border-sky-700",
    hoverBg: "hover:bg-sky-50/30 dark:hover:bg-sky-900/30",
  },
  vacationBalance: {
    icon: PalmtreeIcon,
    href: "/urlaubskonto",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/50 dark:to-green-800/50",
    hoverBorder: "hover:border-green-200 dark:hover:border-green-700",
    hoverBg: "hover:bg-green-50/30 dark:hover:bg-green-900/30",
  },
  timeAccounts: {
    icon: ScaleIcon,
    href: "/zeitkonten",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/50 dark:to-indigo-800/50",
    hoverBorder: "hover:border-indigo-200 dark:hover:border-indigo-700",
    hoverBg: "hover:bg-indigo-50/30 dark:hover:bg-indigo-900/30",
  },
  reports: {
    icon: BarChartIcon,
    href: "/berichte",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-900/50 dark:to-fuchsia-800/50",
    hoverBorder: "hover:border-fuchsia-200 dark:hover:border-fuchsia-700",
    hoverBg: "hover:bg-fuchsia-50/30 dark:hover:bg-fuchsia-900/30",
  },
  payrollExport: {
    icon: FileExportIcon,
    href: "/lohnexport",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/50",
    hoverBorder: "hover:border-emerald-200 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30",
  },
  monthClose: {
    icon: ArchiveIcon,
    href: "/monatsabschluss",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-700/50",
    hoverBorder: "hover:border-gray-300 dark:hover:border-gray-600",
    hoverBg: "hover:bg-gray-50/30 dark:hover:bg-gray-900/30",
  },
  dataIO: {
    icon: DatabaseIcon,
    href: "/daten",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/50 dark:to-cyan-800/50",
    hoverBorder: "hover:border-cyan-200 dark:hover:border-cyan-700",
    hoverBg: "hover:bg-cyan-50/30 dark:hover:bg-cyan-900/30",
  },
  holidays: {
    icon: FlagIcon,
    href: "/feiertage",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/50 dark:to-red-800/50",
    hoverBorder: "hover:border-red-200 dark:hover:border-red-700",
    hoverBg: "hover:bg-red-50/30 dark:hover:bg-red-900/30",
  },
  automationRules: {
    icon: ZapIcon,
    href: "/automatisierung",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/50 dark:to-yellow-800/50",
    hoverBorder: "hover:border-yellow-200 dark:hover:border-yellow-700",
    hoverBg: "hover:bg-yellow-50/30 dark:hover:bg-yellow-900/30",
  },
  webhooks: {
    icon: LinkIcon,
    href: "/webhooks",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50",
    hoverBorder: "hover:border-slate-200 dark:hover:border-slate-600",
    hoverBg: "hover:bg-slate-50/30 dark:hover:bg-slate-900/30",
  },
  settings: {
    icon: SettingsIcon,
    href: "/einstellungen",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-700/50",
    hoverBorder: "hover:border-gray-300 dark:hover:border-gray-600",
    hoverBg: "hover:bg-gray-50/30 dark:hover:bg-gray-900/30",
  },
  billing: {
    icon: CreditCardIcon,
    href: "/einstellungen/abonnement",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/50",
    hoverBorder: "hover:border-emerald-200 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30",
  },
  roles: {
    icon: ShieldCheckIcon,
    href: "/einstellungen/rollen",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/50 dark:to-violet-800/50",
    hoverBorder: "hover:border-violet-200 dark:hover:border-violet-700",
    hoverBg: "hover:bg-violet-50/30 dark:hover:bg-violet-900/30",
  },
};

const ALL_PAGE_KEYS = Object.keys(PAGE_REGISTRY);

interface FavoritesSectionProps {
  initialFavorites: string[];
}

export function FavoritesSection({ initialFavorites }: FavoritesSectionProps) {
  const t = useTranslations("dashboard");
  const tn = useTranslations("nav");
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveControllerRef = useRef<AbortController | null>(null);

  /* Re-fetch favorites from API on mount to avoid stale server props */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/favorites")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.data && Array.isArray(json.data)) {
          setFavorites(json.data);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveFavorites = useCallback((newFavorites: string[]) => {
    setFavorites(newFavorites);

    // Cancel any in-flight save to avoid race conditions
    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
    }
    const controller = new AbortController();
    saveControllerRef.current = controller;

    setIsSaving(true);
    // Fire-and-forget — do NOT use startTransition (it cancels on unmount)
    fetch("/api/dashboard/favorites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorites: newFavorites }),
      signal: controller.signal,
      keepalive: true, // ensures request completes even if page navigates away
    })
      .catch(() => {
        /* aborted or network error — state is optimistic */
      })
      .finally(() => {
        if (saveControllerRef.current === controller) {
          setIsSaving(false);
        }
      });
  }, []);

  const toggleFavorite = useCallback(
    (key: string) => {
      const next = favorites.includes(key)
        ? favorites.filter((k) => k !== key)
        : [...favorites, key];
      saveFavorites(next);
    },
    [favorites, saveFavorites],
  );

  const removeFavorite = useCallback(
    (key: string) => {
      saveFavorites(favorites.filter((k) => k !== key));
    },
    [favorites, saveFavorites],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <StarIcon className="h-4 w-4 text-amber-500" />
          {t("favorites")}
        </CardTitle>
        <button
          onClick={() => setEditing(!editing)}
          className={cn(
            "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
            editing
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/60"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800",
          )}
        >
          {editing ? t("favDone") : t("favEdit")}
        </button>
      </CardHeader>
      <CardContent>
        {/* Pinned Favorites — full-width large tiles */}
        {favorites.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {favorites.map((key) => {
              const page = PAGE_REGISTRY[key];
              if (!page) return null;
              const Icon = page.icon;
              return (
                <div key={key} className="relative group">
                  <Link
                    href={page.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-zinc-800/70 p-5 sm:p-6 border border-gray-100 dark:border-zinc-700 transition-all duration-200",
                      "shadow-[0_1px_6px_-1px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_6px_-1px_rgba(0,0,0,0.3)]",
                      "hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]",
                      "hover:-translate-y-0.5",
                      page.hoverBorder,
                      page.hoverBg,
                      "min-h-[100px] sm:min-h-[110px]",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl p-3 transition-colors",
                        page.bg,
                      )}
                    >
                      <Icon className={cn("h-6 w-6", page.color)} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200 text-center leading-tight">
                      {tn(key)}
                    </span>
                  </Link>
                  {editing && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        removeFavorite(key);
                      }}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-10"
                      aria-label={t("favRemove")}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {favorites.length === 0 && !editing && (
          <div className="text-center py-8">
            <StarIcon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-4">{t("favEmpty")}</p>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              <PlusIcon className="h-4 w-4" />
              {t("favAdd")}
            </button>
          </div>
        )}

        {/* Editing: all available pages */}
        {editing && (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-zinc-700">
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-3">
              {t("favAvailable")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {ALL_PAGE_KEYS.map((key) => {
                const page = PAGE_REGISTRY[key];
                const pinned = favorites.includes(key);
                const Icon = page.icon;
                return (
                  <button
                    key={key}
                    onClick={() => toggleFavorite(key)}
                    disabled={isSaving}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl p-3 sm:p-4 border transition-all duration-200 min-h-[80px]",
                      pinned
                        ? "border-emerald-300 bg-emerald-50/60 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/40"
                        : "border-gray-100 bg-white dark:border-zinc-700 dark:bg-zinc-800/70 hover:border-gray-200 hover:bg-gray-50/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/70",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-xl p-2",
                        pinned
                          ? "bg-emerald-100 dark:bg-emerald-900/60"
                          : page.bg,
                      )}
                    >
                      {pinned ? (
                        <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Icon className={cn("h-5 w-5", page.color)} />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium text-center leading-tight",
                        pinned
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-gray-600 dark:text-zinc-300",
                      )}
                    >
                      {tn(key)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
