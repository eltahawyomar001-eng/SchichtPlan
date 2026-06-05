"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
  FileCheckIcon,
  TicketIcon,
  SearchIcon,
  StarIcon,
  ChevronDownIcon,
  AlertCircleIcon,
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
  /** Optional small label rendered next to the nav item (e.g. "Add-on"). */
  badge?: string;
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
      {
        key: "sos",
        href: "/sos",
        icon: AlertCircleIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
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
        key: "compliance",
        href: "/compliance",
        icon: ShieldCheckIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "pruefungssicher",
        href: "/pruefungssicher",
        icon: FileCheckIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "betriebsrat",
        href: "/betriebsrat",
        icon: ScaleIcon,
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
const WIDTH_KEY = "shiftfy-sidebar-width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256; // matches the original w-64 (16rem)

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

  // Resizable sidebar (desktop only). Width persists to localStorage and is
  // published as a CSS var so the dashboard shell can match its main padding.
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    const raw = window.localStorage.getItem(WIDTH_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!isNaN(parsed)) {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed)));
    }
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, [width]);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.localStorage.setItem(WIDTH_KEY, String(width));
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizing]);

  /* Add-on status — decorates locked nav items with a small badge. */
  const [ticketingActive, setTicketingActive] = useState<boolean | null>(null);
  const [schichtplanungActive, setSchichtplanungActive] = useState<
    boolean | null
  >(null);
  // Works-council members may be regular employees — surface the portal link
  // for them even though it lives in the management nav group.
  const [brMember, setBrMember] = useState(false);
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setWorkspaceLogo(d.logo ?? null);
          setWorkspaceName(d.name ?? null);
        }
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/betriebsrat/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setBrMember(Boolean(d.isMember));
      })
      .catch(() => {
        /* fail-quiet */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/billing/addons")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setTicketingActive(Boolean(data.ticketing?.active));
          setSchichtplanungActive(Boolean(data.schichtplanung?.active));
        }
      })
      .catch(() => {
        /* fail-quiet: badge simply won't show */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  /* Build a flat list of all visible nav items for search + favorites */
  const allVisibleItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const group of navGroups) {
      for (const item of group.items) {
        const brAllowed = item.key === "betriebsrat" && brMember;
        if (
          !item.roles ||
          (userRole && item.roles.includes(userRole)) ||
          brAllowed
        ) {
          // Decorate ticketing/schichtplanung nav with "Add-on" badge only
          // for roles that can actually subscribe (OWNER/ADMIN). Employees
          // and managers should not see upsell badges.
          const canSeeAddonBadge = userRole === "OWNER" || userRole === "ADMIN";
          if (
            canSeeAddonBadge &&
            item.key === "tickets" &&
            ticketingActive === false
          ) {
            items.push({ ...item, badge: t("addonBadge") });
          } else if (
            canSeeAddonBadge &&
            item.key === "shiftPlan" &&
            schichtplanungActive === false
          ) {
            items.push({ ...item, badge: t("addonBadge") });
          } else {
            items.push(item);
          }
        }
      }
    }
    return items;
  }, [userRole, ticketingActive, schichtplanungActive, brMember, t]);

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
        style={{
          // Mobile uses fixed w-64; desktop uses dynamic width via CSS var.
          // Inline `width` only applies on lg: via the className override.
          ["--sb-w" as string]: `${width}px`,
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 lg:w-[var(--sb-w,16rem)] flex-col bg-sidebar-bg text-sidebar-text",
          !resizing && "transition-transform duration-300 ease-in-out",
          "border-r border-sidebar-border",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Desktop resize handle — drag to resize, double-click to reset */}
        <div
          role="separator"
          aria-label="Sidebar resize"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault();
            setResizing(true);
          }}
          onDoubleClick={() => {
            setWidth(DEFAULT_WIDTH);
            window.localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
          }}
          className="hidden lg:block absolute top-0 right-0 h-full w-1.5 -mr-0.5 cursor-col-resize group z-10"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover:bg-brand transition-colors" />
        </div>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 flex-shrink-0 py-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-[12px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-[var(--sh-brand)]">
              <ShiftfyMark className="h-6 w-6 text-white" />
            </div>
            <span className="text-[22px] font-extrabold tracking-[-0.03em] text-sidebar-text">
              Shift<span className="text-brand">fy</span>
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Menü schließen"
            className="rounded-[var(--r-sm)] p-2.5 text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text active:scale-95 transition-colors lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace identity */}
        {workspaceLogo && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 bg-white/5 border border-sidebar-border">
              <div className="relative h-12 w-12 rounded-[var(--r-sm)] overflow-hidden border border-sidebar-border bg-white/10 flex-shrink-0">
                <img
                  src={workspaceLogo}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              </div>
              {workspaceName && (
                <span className="text-sm font-semibold text-sidebar-text truncate leading-tight">
                  {workspaceName}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("sidebarSearch")}
              className="w-full rounded-[var(--r-sm)] border border-sidebar-border bg-white/5 pl-9 pr-3 h-[38px] text-[var(--t-sm)] text-sidebar-text placeholder:text-sidebar-text-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sidebar-text-muted hover:text-sidebar-text"
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
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-sidebar-text-muted">
                  {t("favorites")}
                </p>
                <div className="h-px flex-1 bg-sidebar-border" />
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
              if (item.key === "betriebsrat" && brMember) return true;
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
                    className="w-full mb-1.5 flex items-center gap-2 px-3 pt-2 group/header"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-sidebar-text-muted group-hover/header:text-sidebar-text transition-colors">
                      {t(group.labelKey)}
                    </p>
                    <div className="h-px flex-1 bg-sidebar-border" />
                    {!query && (
                      <ChevronDownIcon
                        className={cn(
                          "w-3 h-3 text-sidebar-text-muted transition-transform duration-200",
                          isCollapsed && "-rotate-90",
                        )}
                      />
                    )}
                  </button>
                ) : groupIdx > 0 ? (
                  <div className="mb-1.5 px-3">
                    <div className="h-px bg-sidebar-border" />
                  </div>
                ) : null}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {filteredItems.map((rawItem) => {
                      // Apply add-on badge decoration (mirrors allVisibleItems logic)
                      // Only show upsell badge to OWNER/ADMIN who can act on it.
                      const canSeeAddonBadge2 =
                        userRole === "OWNER" || userRole === "ADMIN";
                      const item: NavItem =
                        canSeeAddonBadge2 &&
                        rawItem.key === "tickets" &&
                        ticketingActive === false
                          ? { ...rawItem, badge: t("addonBadge") }
                          : canSeeAddonBadge2 &&
                              rawItem.key === "shiftPlan" &&
                              schichtplanungActive === false
                            ? { ...rawItem, badge: t("addonBadge") }
                            : rawItem;
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
        <div className="border-t border-sidebar-border p-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex-shrink-0 space-y-1.5">
          {/* User info row */}
          {userName && (
            <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-sidebar-border bg-white/5 px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white flex-shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[var(--t-sm)] font-[650] text-sidebar-text">
                  {userName}
                </p>
                {userEmail && (
                  <p className="truncate text-[var(--t-xs)] text-sidebar-text-muted">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-[var(--r-sm)] px-3 py-2 text-sm text-sidebar-text-muted">
            <CookieSettingsButton />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label={t("logout")}
            className="flex w-full items-center gap-3 rounded-[var(--r-sm)] px-3 py-2.5 text-sm font-medium text-sidebar-text-muted hover:bg-red-500/10 hover:text-red-400 active:scale-[0.98] transition-colors"
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
          "relative flex flex-1 items-center gap-3 rounded-[var(--r-sm)] px-3 h-10 text-[var(--t-base)] transition-colors duration-[var(--d-fast)] min-w-0",
          isActive
            ? "bg-brand/15 text-brand-300 font-semibold before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-[3px] before:bg-brand"
            : "font-medium text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text",
        )}
      >
        <item.icon
          className={cn(
            "h-[19px] w-[19px] flex-shrink-0 transition-colors",
            isActive ? "text-brand-300" : "text-sidebar-text-muted opacity-90",
          )}
        />
        <span className="truncate">{t(item.key)}</span>
        {item.badge && (
          <span className="ml-auto rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-warning">
            {item.badge}
          </span>
        )}
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
            ? "opacity-100 text-amber-400 hover:text-amber-300"
            : "opacity-0 group-hover/nav:opacity-100 text-sidebar-text-muted hover:text-amber-400",
        )}
      >
        <StarIcon className={cn("w-3 h-3", isFavorite && "fill-amber-400")} />
      </button>
    </div>
  );
}
