"use client";

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
  HandRaisedIcon,
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
  HeartPulseIcon,
  FileCheckIcon,
  TicketIcon,
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
      { key: "availability", href: "/verfuegbarkeiten", icon: HandRaisedIcon },
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
        key: "wellness",
        href: "/wohlbefinden",
        icon: HeartPulseIcon,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "payrollExport",
        href: "/lohnexport",
        icon: FileExportIcon,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "monthClose",
        href: "/monatsabschluss",
        icon: ArchiveIcon,
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

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role as
    | Role
    | undefined;
  const userName = (session?.user as { name?: string } | undefined)?.name;
  const userEmail = (session?.user as { email?: string } | undefined)?.email;

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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white transition-transform duration-300 ease-in-out",
          "border-r border-gray-100 shadow-[1px_0_8px_rgba(0,0,0,0.04)]",
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
            <span className="text-lg font-bold text-gray-900">
              Shift<span className="text-gradient">fy</span>
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Menü schließen"
            className="rounded-xl p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200 lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => {
              if (!item.roles) return true;
              if (!userRole) return false;
              return item.roles.includes(userRole);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIdx} className={groupIdx > 0 ? "mt-5" : ""}>
                {group.labelKey && (
                  <div className="mb-2 flex items-center gap-2 px-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {t(group.labelKey)}
                    </p>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 min-w-0 active:scale-[0.98]",
                          isActive
                            ? "bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100 sidebar-active-glow"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                            isActive ? "text-emerald-600" : "text-gray-400",
                          )}
                        />
                        <span className="truncate">{t(item.key)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer — user info + logout */}
        <div className="border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex-shrink-0 space-y-1.5">
          {/* User info row */}
          {userName && (
            <div className="flex items-center gap-3 rounded-xl px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {userName}
                </p>
                {userEmail && (
                  <p className="truncate text-xs text-gray-400">{userEmail}</p>
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
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100 active:scale-[0.98] transition-colors"
          >
            <LogOutIcon className="h-[18px] w-[18px]" />
            {t("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
