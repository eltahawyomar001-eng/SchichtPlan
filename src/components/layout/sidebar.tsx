"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  CalendarIcon,
  UsersIcon,
  MapPinIcon,
  SettingsIcon,
  LogOutIcon,
  SchichtPlanMark,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Schichtplan", href: "/schichtplan", icon: CalendarIcon },
  { label: "Mitarbeiter", href: "/mitarbeiter", icon: UsersIcon },
  { label: "Standorte", href: "/standorte", icon: MapPinIcon },
  { label: "Einstellungen", href: "/einstellungen", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-6">
        <SchichtPlanMark className="h-8 w-8" />
        <span className="text-lg font-bold text-gray-900">
          Schicht<span className="text-gradient">Plan</span>
        </span>
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
              {item.label}
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
          Abmelden
        </button>
      </div>
    </aside>
  );
}
