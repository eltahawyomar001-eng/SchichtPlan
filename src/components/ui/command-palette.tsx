"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type SVGProps,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  DashboardIcon,
  CalendarIcon,
  UsersIcon,
  MapPinIcon,
  SettingsIcon,
  ClockIcon,
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
  ArchiveIcon,
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
} from "@/components/icons";
import type { Role } from "@/lib/authorization";

interface CommandItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  group: string;
  keywords?: string[];
  roles?: Role[];
}

/**
 * Global command palette (Cmd+K / Ctrl+K).
 *
 * Provides instant keyboard-driven navigation across all 33+ app sections.
 * Renders as a centered modal overlay with search input and filtered results.
 *
 * Place this once inside the DashboardShell.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role as
    | Role
    | undefined;

  // All navigable items
  const allItems: CommandItem[] = useMemo(
    () => [
      // Main
      {
        id: "dashboard",
        label: t("dashboard"),
        href: "/dashboard",
        icon: DashboardIcon,
        group: "Navigation",
        keywords: ["start", "home", "übersicht", "overview"],
      },
      {
        id: "shiftPlan",
        label: t("shiftPlan"),
        href: "/schichtplan",
        icon: CalendarIcon,
        group: "Navigation",
        keywords: ["plan", "dienstplan", "schedule", "shift"],
      },
      {
        id: "timeTracking",
        label: t("timeTracking"),
        href: "/zeiterfassung",
        icon: ClockIcon,
        group: "Navigation",
        keywords: ["zeit", "stunden", "hours", "time", "clock"],
      },
      {
        id: "absences",
        label: t("absences"),
        href: "/abwesenheiten",
        icon: CalendarOffIcon,
        group: "Navigation",
        keywords: ["urlaub", "krank", "vacation", "sick", "leave"],
      },
      {
        id: "shiftSwap",
        label: t("shiftSwap"),
        href: "/schichttausch",
        icon: SwapIcon,
        group: "Navigation",
        keywords: ["tausch", "swap", "wechsel"],
      },
      {
        id: "punchClock",
        label: t("punchClock"),
        href: "/stempeluhr",
        icon: TargetIcon,
        group: "Navigation",
        keywords: ["stempel", "terminal", "stamp", "check-in"],
      },
      {
        id: "serviceProof",
        label: t("serviceProof"),
        href: "/leistungsnachweis",
        icon: FileCheckIcon,
        group: "Navigation",
        keywords: ["leistung", "nachweis", "service", "proof"],
      },
      {
        id: "teamChat",
        label: t("teamChat"),
        href: "/nachrichten",
        icon: MessageCircleIcon,
        group: "Navigation",
        keywords: ["chat", "nachricht", "message", "kommunikation"],
      },
      {
        id: "tickets",
        label: t("tickets"),
        href: "/tickets",
        icon: TicketIcon,
        group: "Navigation",
        keywords: ["ticket", "support", "anfrage", "request"],
      },
      {
        id: "teamCalendar",
        label: t("teamCalendar"),
        href: "/teamkalender",
        icon: CalendarUsersIcon,
        group: "Navigation",
        keywords: ["team", "kalender", "calendar"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "annualPlanning",
        label: t("annualPlanning"),
        href: "/jahresplanung",
        icon: CalendarRangeIcon,
        group: "Navigation",
        keywords: ["jahres", "annual", "year", "planung"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },

      // Management
      {
        id: "employees",
        label: t("employees"),
        href: "/mitarbeiter",
        icon: UsersIcon,
        group: t("management"),
        keywords: ["personal", "staff", "team", "mitarbeiter"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "departments",
        label: t("departments"),
        href: "/abteilungen",
        icon: LayersIcon,
        group: t("management"),
        keywords: ["abteilung", "objekt", "department", "object"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "skills",
        label: t("skills"),
        href: "/qualifikationen",
        icon: AwardIcon,
        group: t("management"),
        keywords: ["qualifikation", "skill", "fähigkeit", "kompetenz"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "locations",
        label: t("locations"),
        href: "/standorte",
        icon: MapPinIcon,
        group: t("management"),
        keywords: ["standort", "location", "ort", "filiale"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "shiftTemplates",
        label: t("shiftTemplates"),
        href: "/schichtvorlagen",
        icon: TemplateIcon,
        group: t("management"),
        keywords: ["vorlage", "template", "muster"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "projects",
        label: t("projects"),
        href: "/projekte",
        icon: FolderIcon,
        group: t("management"),
        keywords: ["projekt", "project", "auftrag"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "clients",
        label: t("clients"),
        href: "/kunden",
        icon: UsersIcon,
        group: t("management"),
        keywords: ["kunde", "client", "auftraggeber"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },

      // Tracking & Reports
      {
        id: "vacationBalance",
        label: t("vacationBalance"),
        href: "/urlaubskonto",
        icon: PalmtreeIcon,
        group: t("trackingReports"),
        keywords: ["urlaub", "konto", "vacation", "balance", "resturlaub"],
      },
      {
        id: "timeAccounts",
        label: t("timeAccounts"),
        href: "/zeitkonten",
        icon: ScaleIcon,
        group: t("trackingReports"),
        keywords: ["zeitkonto", "stunden", "überstunden", "overtime"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "reports",
        label: t("reports"),
        href: "/berichte",
        icon: BarChartIcon,
        group: t("trackingReports"),
        keywords: ["bericht", "report", "analyse", "statistik"],
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        id: "payrollExport",
        label: t("payrollExport"),
        href: "/lohnexport",
        icon: FileExportIcon,
        group: t("trackingReports"),
        keywords: ["lohn", "export", "payroll", "datev", "gehalt"],
        roles: ["OWNER", "ADMIN"],
      },
      {
        id: "monthClose",
        label: t("monthClose"),
        href: "/monatsabschluss",
        icon: ArchiveIcon,
        group: t("trackingReports"),
        keywords: ["monat", "abschluss", "close", "abrechnung"],
        roles: ["OWNER", "ADMIN"],
      },
      {
        id: "dataIO",
        label: t("dataIO"),
        href: "/daten",
        icon: DatabaseIcon,
        group: t("trackingReports"),
        keywords: ["import", "export", "daten", "data", "csv"],
        roles: ["OWNER", "ADMIN"],
      },
      {
        id: "holidays",
        label: t("holidays"),
        href: "/feiertage",
        icon: FlagIcon,
        group: t("trackingReports"),
        keywords: ["feiertag", "holiday", "frei"],
      },
      {
        id: "automationRules",
        label: t("automationRules"),
        href: "/automatisierung",
        icon: ZapIcon,
        group: t("trackingReports"),
        keywords: ["automation", "regel", "rule", "automatisch"],
        roles: ["OWNER", "ADMIN"],
      },

      // Developer
      {
        id: "webhooks",
        label: t("webhooks"),
        href: "/webhooks",
        icon: LinkIcon,
        group: t("developer"),
        keywords: ["webhook", "api", "integration"],
        roles: ["OWNER", "ADMIN"],
      },

      // Settings
      {
        id: "settings",
        label: t("settings"),
        href: "/einstellungen",
        icon: SettingsIcon,
        group: t("settings"),
        keywords: ["einstellung", "setting", "konfiguration", "config"],
      },
      {
        id: "billing",
        label: t("billing"),
        href: "/einstellungen/abonnement",
        icon: CreditCardIcon,
        group: t("settings"),
        keywords: ["abo", "plan", "billing", "zahlung", "subscription"],
        roles: ["OWNER", "ADMIN"],
      },
      {
        id: "roles",
        label: t("roles"),
        href: "/einstellungen/rollen",
        icon: ShieldCheckIcon,
        group: t("settings"),
        keywords: ["rolle", "role", "berechtigung", "permission"],
        roles: ["OWNER", "ADMIN"],
      },
    ],
    [t],
  );

  // Filter by role
  const accessibleItems = useMemo(
    () =>
      allItems.filter((item) => {
        if (!item.roles) return true;
        if (!userRole) return false;
        return item.roles.includes(userRole);
      }),
    [allItems, userRole],
  );

  // Filter by search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return accessibleItems;
    const q = query.toLowerCase().trim();
    return accessibleItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q) ||
        item.keywords?.some((kw) => kw.includes(q)),
    );
  }, [accessibleItems, query]);

  // Group filtered items
  const groupedItems = useMemo(() => {
    const groups: { label: string; items: CommandItem[] }[] = [];
    for (const item of filteredItems) {
      const existing = groups.find((g) => g.label === item.group);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ label: item.group, items: [item] });
      }
    }
    return groups;
  }, [filteredItems]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(
    () => groupedItems.flatMap((g) => g.items),
    [groupedItems],
  );

  // Open / close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open, reset state
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Delay to allow animation
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Navigate to selected item
  const navigate = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatItems[activeIndex]) {
          navigate(flatItems[activeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [flatItems, activeIndex, navigate],
  );

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] sm:pt-[20vh] bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Suche &amp; Navigation"
        className="w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden animate-[commandIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-zinc-800">
          <SearchIcon className="h-5 w-5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche oder navigiere… (Seite, Funktion)"
            className="flex-1 h-14 bg-transparent text-base text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none"
            aria-autocomplete="list"
            aria-controls="command-list"
          />
          <kbd className="hidden sm:inline-flex h-6 items-center gap-0.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-1.5 text-[11px] font-medium text-gray-400 dark:text-zinc-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          id="command-list"
          ref={listRef}
          role="listbox"
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
              Keine Ergebnisse für &quot;{query}&quot;
            </div>
          ) : (
            groupedItems.map((group) => (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    {group.label}
                  </p>
                </div>
                {group.items.map((item) => {
                  flatIndex++;
                  const isActive = flatIndex === activeIndex;
                  const isCurrent = pathname === item.href;
                  const idx = flatIndex; // capture for click handler

                  return (
                    <button
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] flex-shrink-0",
                          isActive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-400 dark:text-zinc-500",
                        )}
                      />
                      <span className="flex-1 truncate font-medium">
                        {item.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[11px] font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                          Aktiv
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-zinc-800 text-[11px] text-gray-400 dark:text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-5 items-center rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-1 text-[10px] font-medium">
                ↑
              </kbd>
              <kbd className="inline-flex h-5 items-center rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-1 text-[10px] font-medium">
                ↓
              </kbd>
              Navigieren
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-5 items-center rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-1 text-[10px] font-medium">
                ↵
              </kbd>
              Öffnen
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-1.5 text-[10px] font-medium">
              ⌘K
            </kbd>
            Umschalten
          </span>
        </div>
      </div>
    </div>
  );
}
