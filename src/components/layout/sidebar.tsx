"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: DashboardIcon },
  { key: "shiftPlan", href: "/schichtplan", icon: CalendarIcon },
  { key: "timeTracking", href: "/zeiterfassung", icon: ClockIcon },
  { key: "absences", href: "/abwesenheiten", icon: CalendarOffIcon },
  { key: "availability", href: "/verfuegbarkeiten", icon: HandRaisedIcon },
  { key: "shiftSwap", href: "/schichttausch", icon: SwapIcon },
  { key: "timeAccounts", href: "/zeitkonten", icon: ScaleIcon },
  { key: "payrollExport", href: "/lohnexport", icon: FileExportIcon },
  { key: "employees", href: "/mitarbeiter", icon: UsersIcon },
  { key: "locations", href: "/standorte", icon: MapPinIcon },
  { key: "settings", href: "/einstellungen", icon: SettingsIcon },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

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
          // Desktop: always visible
          "lg:translate-x-0",
          // Mobile: slide in/out
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <div className="flex items-center gap-2.5">
            <SchichtPlanMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-900">
              Schicht<span className="text-gradient">Plan</span>
            </span>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-w-0",
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? "text-violet-700" : "text-gray-400",
                  )}
                />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOutIcon className="h-5 w-5 text-gray-400" />
            {t("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
