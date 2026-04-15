"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import {
  DashboardIcon,
  CalendarIcon,
  UsersIcon,
  MapPinIcon,
  SettingsIcon,
  LogOutIcon,
  ShiftfyMark,
  ClockIcon,
  XIcon,
  CalendarOffIcon,
  SwapIcon,
  ScaleIcon,
  FileExportIcon,
  BarChartIcon,
  FlagIcon,
  LayersIcon,
  AwardIcon,
  PalmtreeIcon,
  TemplateIcon,
  FolderIcon,
  TargetIcon,
  LinkIcon,
  ZapIcon,
  DatabaseIcon,
  CalendarUsersIcon,
  CalendarRangeIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  MessageCircleIcon,
  FileCheckIcon,
  TicketIcon,
  SearchIcon,
  StarIcon,
  ChevronDownIcon,
} from "@/components/icons";
import { CookieSettingsButton } from "@/components/cookie-banner";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import type { Role } from "@/lib/authorization";

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

interface NavGroup {
  labelKey?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    // Main — visible to all
    items: [
      { key: "dashboard", href: "/dashboard", icon: DashboardIcon },
      { key: "shiftPlan", href: "/schichtplan", icon: CalendarIcon },
      { key: "timeTracking", href: "/zeiterfassung", icon: ClockIcon },
      { key: "absences", href: "/abwesenheiten", icon: CalendarOffIcon },
      { key: "shiftSwap", href: "/schichttausch", icon: SwapIcon },
      { key: "punchClock", href: "/stempeluhr", icon: TargetIcon },
      {
        key: "serviceProof",
        href: "/leistungsnachweis",
        icon: FileCheckIcon,
      },
      {
        key: "teamChat",
        href: "/nachrichten",
        icon: MessageCircleIcon,
      },
      {
        key: "tickets",
        href: "/tickets",
        icon: TicketIcon,
      },
      {
        key: "teamCalendar",
        href: "/teamkalender",
        icon: CalendarUsersIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "annualPlanning",
        href: "/jahresplanung",
        icon: CalendarRangeIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
    ],
  },
  {
    // Management
    labelKey: "management",
    items: [
      {
        key: "employees",
        href: "/mitarbeiter",
        icon: UsersIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "departments",
        href: "/abteilungen",
        icon: LayersIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "skills",
        href: "/qualifikationen",
        icon: AwardIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "locations",
        href: "/standorte",
        icon: MapPinIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "shiftTemplates",
        href: "/schichtvorlagen",
        icon: TemplateIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "projects",
        href: "/projekte",
        icon: FolderIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "clients",
        href: "/kunden",
        icon: UsersIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
    ],
  },
  {
    // Tracking & Reports
    labelKey: "trackingReports",
    items: [
      {
        key: "vacationBalance",
        href: "/urlaubskonto",
        icon: PalmtreeIcon,
        roles: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        key: "timeAccounts",
        href: "/zeitkonten",
        icon: ScaleIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "reports",
        href: "/berichte",
        icon: BarChartIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "payrollExport",
        href: "/lohnexport",
        icon: FileExportIcon,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "dataIO",
        href: "/daten",
        icon: DatabaseIcon,
        roles: ["OWNER", "ADMIN"],
      },
      { key: "holidays", href: "/feiertage", icon: FlagIcon },
      {
        key: "automationRules",
        href: "/automatisierung",
        icon: ZapIcon,
        roles: ["OWNER", "ADMIN"],
      },
    ],
  },
  {
    // Developer
    labelKey: "developer",
    items: [
      {
        key: "webhooks",
        href: "/webhooks",
        icon: LinkIcon,
        roles: ["OWNER", "ADMIN"],
      },
    ],
  },
  {
    // Settings
    items: [
      {
        key: "settings",
        href: "/einstellungen",
        icon: SettingsIcon,
      },
      {
        key: "billing",
        href: "/einstellungen/abonnement",
        icon: CreditCardIcon,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "roles",
        href: "/einstellungen/rollen",
        icon: ShieldCheckIcon,
        roles: ["OWNER", "ADMIN"],
      },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const FAVORITES_KEY = "shiftfy-sidebar-favorites";
const COLLAPSED_KEY = "shiftfy-sidebar-collapsed";

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          parsed.every((v) => typeof v === "string")
        ) {
          return parsed as string[];
        }
        localStorage.removeItem(FAVORITES_KEY);
      }
    } catch {
      /* ignore — invalid JSON or storage unavailable */
    }
    return [];
  });

  const toggle = useCallback((href: string) => {
    setFavorites((prev) => {
      const next = prev.includes(href)
        ? prev.filter((f) => f !== href)
        : prev.length < 8
          ? [...prev, href]
          : prev;
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { favorites, toggle };
}

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<number, boolean>;
        }
        localStorage.removeItem(COLLAPSED_KEY);
      }
    } catch {
      /* ignore — invalid JSON or storage unavailable */
    }
    return {};
  });

  const toggleGroup = useCallback((idx: number) => {
    setCollapsed((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { collapsed, toggleGroup };
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role as
    | Role
    | undefined;
  const userName = (session?.user as { name?: string } | undefined)?.name;
  const userEmail = (session?.user as { email?: string } | undefined)?.email;

  const [search, setSearch] = useState("");
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { collapsed, toggleGroup } = useCollapsedGroups();

  /* Build a flat list of all visible nav items for search + favorites */
  const allVisibleItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const group of navGroups) {
      for (const item of group.items) {
        if (!item.roles || (userRole && item.roles.includes(userRole))) {
          items.push(item);
        }
      }
    }
    return items;
  }, [userRole]);

  /* Pinned items (favorites) */
  const pinnedItems = useMemo(
    () => allVisibleItems.filter((item) => favorites.includes(item.href)),
    [allVisibleItems, favorites],
  );

  /* Search-filtered groups */
  const query = search.trim().toLowerCase();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        role="navigation"
        aria-label="Hauptnavigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-zinc-900 transition-transform duration-300 ease-in-out",
          "border-r border-gray-100 dark:border-zinc-800 shadow-[1px_0_8px_rgba(0,0,0,0.04)]",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 flex-shrink-0 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
              <ShiftfyMark className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">
              Shift<span className="text-gradient">fy</span>
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Menü schließen"
            className="rounded-xl p-2.5 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300 active:bg-gray-200 dark:active:bg-zinc-700 lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("sidebarSearch")}
              className="w-full rounded-lg border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 pl-8 pr-3 py-1.5 text-xs text-gray-700 dark:text-zinc-300 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {/* ── Favorites group ── */}
          {pinnedItems.length > 0 && !query && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 px-3">
                <StarIcon className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  {t("favorites")}
                </p>
                <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
              </div>
              <div className="space-y-0.5">
                {pinnedItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <NavLink
                      key={"fav-" + item.href}
                      item={item}
                      isActive={isActive}
                      isFavorite
                      onToggleFavorite={() => toggleFavorite(item.href)}
                      onClick={onClose}
                      t={t}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Regular nav groups ── */}
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => {
              if (!item.roles) return true;
              if (!userRole) return false;
              return item.roles.includes(userRole);
            });

            if (visibleItems.length === 0) return null;

            /* Search filter */
            const filteredItems = query
              ? visibleItems.filter((item) =>
                  t(item.key).toLowerCase().includes(query),
                )
              : visibleItems;

            if (query && filteredItems.length === 0) return null;

            const isCollapsed = !query && collapsed[groupIdx];

            return (
              <div key={groupIdx} className={groupIdx > 0 ? "mt-4" : ""}>
                {group.labelKey ? (
                  <button
                    onClick={() => !query && toggleGroup(groupIdx)}
                    className="w-full mb-1.5 flex items-center gap-2 px-3 group/header"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 group-hover/header:text-gray-600 dark:group-hover/header:text-zinc-300 transition-colors">
                      {t(group.labelKey)}
                    </p>
                    <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
                    {!query && (
                      <ChevronDownIcon
                        className={cn(
                          "w-3 h-3 text-gray-300 dark:text-zinc-600 transition-transform duration-200",
                          isCollapsed && "-rotate-90",
                        )}
                      />
                    )}
                  </button>
                ) : groupIdx > 0 ? (
                  <div className="mb-1.5 px-3">
                    <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                  </div>
                ) : null}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {filteredItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                      const isFav = favorites.includes(item.href);
                      return (
                        <NavLink
                          key={item.href}
                          item={item}
                          isActive={isActive}
                          isFavorite={isFav}
                          onToggleFavorite={() => toggleFavorite(item.href)}
                          onClick={onClose}
                          t={t}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — user info + logout */}
        <div className="border-t border-gray-100 dark:border-zinc-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex-shrink-0 space-y-1.5">
          {/* User info row */}
          {userName && (
            <div className="flex items-center gap-3 rounded-xl px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {userName}
                </p>
                {userEmail && (
                  <p className="truncate text-xs text-gray-400 dark:text-zinc-400">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400">
            <CookieSettingsButton />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label={t("logout")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 active:bg-red-100 dark:active:bg-red-900/30 active:scale-[0.98] transition-colors"
          >
            <LogOutIcon className="h-[18px] w-[18px]" />
            {t("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── Individual Nav Link with favorite star ─── */
function NavLink({
  item,
  isActive,
  isFavorite,
  onToggleFavorite,
  onClick,
  t,
}: {
  item: NavItem;
  isActive: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick?: () => void;
  t: ReturnType<typeof useTranslations<"nav">>;
}) {
  return (
    <div className="group/nav relative flex items-center">
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 min-w-0 active:scale-[0.98]",
          isActive
            ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-emerald-100 dark:shadow-emerald-900/30 sidebar-active-glow"
            : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-200 active:bg-gray-100 dark:active:bg-zinc-700",
        )}
      >
        <item.icon
          className={cn(
            "h-[18px] w-[18px] flex-shrink-0 transition-colors",
            isActive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-gray-400 dark:text-zinc-500",
          )}
        />
        <span className="truncate">{t(item.key)}</span>
      </Link>

      {/* Favorite star — shows on hover or if already favorited */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
        aria-label={isFavorite ? t("favRemove") : t("favAdd")}
        className={cn(
          "absolute right-1.5 p-1 rounded-md transition-all",
          isFavorite
            ? "opacity-100 text-amber-400 hover:text-amber-500"
            : "opacity-0 group-hover/nav:opacity-100 text-gray-300 dark:text-zinc-600 hover:text-amber-400 dark:hover:text-amber-400",
        )}
      >
        <StarIcon className={cn("w-3 h-3", isFavorite && "fill-amber-400")} />
      </button>
    </div>
  );
}
