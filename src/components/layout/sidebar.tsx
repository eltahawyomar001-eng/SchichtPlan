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
  SchichtPlanMark,
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
} from "@/components/icons";
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
      {
        key: "punchClock",
        href: "/stempeluhr",
        icon: TargetIcon,
      },
      {
        key: "teamCalendar",
        href: "/teamkalender",
        icon: CalendarUsersIcon,
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
        roles: ["OWNER", "ADMIN", "MANAGER"],
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
    ],
  },
  {
    // Settings & Developer
    labelKey: "developer",
    items: [
      {
        key: "automationRules",
        href: "/automatisierung",
        icon: ZapIcon,
        roles: ["OWNER", "ADMIN"],
      },
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
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 flex-shrink-0 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2.5">
            <SchichtPlanMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-900">
              Schicht<span className="text-gradient">Plan</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => {
              if (!item.roles) return true;
              if (!userRole) return false;
              return item.roles.includes(userRole);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIdx} className={groupIdx > 0 ? "mt-4" : ""}>
                {group.labelKey && (
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {t(group.labelKey)}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-w-0",
                          isActive
                            ? "bg-violet-50 text-violet-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 flex-shrink-0",
                            isActive ? "text-violet-700" : "text-gray-400",
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

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex-shrink-0">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOutIcon className="h-5 w-5 text-gray-400" />
            {t("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
