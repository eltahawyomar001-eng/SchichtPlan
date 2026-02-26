"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DashboardIcon,
  CalendarIcon,
  ClockIcon,
  MessageCircleIcon,
  MenuIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

interface NavTab {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: NavTab[] = [
  { key: "dashboard", href: "/dashboard", icon: DashboardIcon },
  { key: "shiftPlan", href: "/schichtplan", icon: CalendarIcon },
  { key: "punchClock", href: "/stempeluhr", icon: ClockIcon },
  { key: "teamChat", href: "/nachrichten", icon: MessageCircleIcon },
];

interface MobileBottomNavProps {
  onMoreTap: () => void;
}

export function MobileBottomNav({ onMoreTap }: MobileBottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  // Check if "more" is active (any page not in the 4 tabs)
  const isTabActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const anyTabActive = tabs.some((tab) => isTabActive(tab.href));
  const moreActive = !anyTabActive;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Blur background */}
      <div className="absolute inset-0 border-t border-gray-200/60 bg-white/80 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)]" />

      <div className="relative flex items-end justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-colors min-w-[4rem]",
                "active:scale-95 active:opacity-80",
                active
                  ? "text-emerald-600"
                  : "text-gray-400 hover:text-gray-600",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200",
                  active && "bg-emerald-50 scale-110",
                )}
              >
                <tab.icon
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    active ? "text-emerald-600" : "text-gray-400",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight transition-colors",
                  active ? "text-emerald-600 font-semibold" : "text-gray-400",
                )}
              >
                {t(tab.key)}
              </span>
            </Link>
          );
        })}

        {/* More button — opens sidebar */}
        <button
          onClick={onMoreTap}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-colors min-w-[4rem]",
            "active:scale-95 active:opacity-80",
            moreActive
              ? "text-emerald-600"
              : "text-gray-400 hover:text-gray-600",
          )}
        >
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200",
              moreActive && "bg-emerald-50 scale-110",
            )}
          >
            <MenuIcon
              className={cn(
                "h-[22px] w-[22px] transition-colors",
                moreActive ? "text-emerald-600" : "text-gray-400",
              )}
            />
          </div>
          <span
            className={cn(
              "text-[10px] font-medium leading-tight transition-colors",
              moreActive ? "text-emerald-600 font-semibold" : "text-gray-400",
            )}
          >
            {t("more")}
          </span>
        </button>
      </div>
    </nav>
  );
}
