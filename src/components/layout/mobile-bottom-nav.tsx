"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  onMoreTap: () => void;
}

/* ── iOS-style filled icons for active state ─────────────────── */

function DashboardOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={1.8}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function DashboardFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function CalendarOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={1.8}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function CalendarFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16 2a1 1 0 011 1v2h2.5A2.5 2.5 0 0122 7.5V19.5a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 19.5V7.5A2.5 2.5 0 014.5 5H7V3a1 1 0 012 0v2h6V3a1 1 0 011-1zM4 11v8.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V11H4z" />
    </svg>
  );
}

function ClockOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={1.8}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ClockFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm.75 5a.75.75 0 00-1.5 0v5c0 .199.079.39.22.53l3 3a.75.75 0 101.06-1.06L12.75 11.69V7z"
      />
    </svg>
  );
}

function ChatOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={1.8}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 104 16.1L2 22z" />
    </svg>
  );
}

function ChatFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5.002L1.08 22.32a.75.75 0 00.92.92l5.318-2.258A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
    </svg>
  );
}

function EllipsisOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth={1.8}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function EllipsisFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/* ── Tab configuration ──────────────────────────────────────── */

interface NavTab {
  key: string;
  href: string;
  outline: React.ComponentType<{ className?: string }>;
  filled: React.ComponentType<{ className?: string }>;
}

const tabs: NavTab[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    outline: DashboardOutline,
    filled: DashboardFilled,
  },
  {
    key: "shiftPlan",
    href: "/schichtplan",
    outline: CalendarOutline,
    filled: CalendarFilled,
  },
  {
    key: "punchClock",
    href: "/stempeluhr",
    outline: ClockOutline,
    filled: ClockFilled,
  },
  {
    key: "teamChat",
    href: "/nachrichten",
    outline: ChatOutline,
    filled: ChatFilled,
  },
];

export function MobileBottomNav({ onMoreTap }: MobileBottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

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
      {/* iOS-style frosted glass — no visible top border, pure blur */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl backdrop-saturate-[1.8] [-webkit-backdrop-filter:saturate(180%)_blur(20px)]" />
      {/* Hairline separator — 0.5px like iOS */}
      <div className="absolute inset-x-0 top-0 h-px bg-black/[0.08]" />

      <div className="relative flex items-stretch justify-around px-1 pb-[max(0.125rem,env(safe-area-inset-bottom))] pt-1">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href);
          const Icon = active ? tab.filled : tab.outline;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-[2px] py-1.5 min-h-[48px] transition-all duration-150",
                "active:opacity-60",
                active ? "text-emerald-600" : "text-gray-400",
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span
                className={cn(
                  "text-[10px] leading-tight tracking-wide",
                  active
                    ? "font-semibold text-emerald-600"
                    : "font-medium text-gray-400",
                )}
              >
                {t(tab.key)}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={onMoreTap}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-[2px] py-1.5 min-h-[48px] transition-all duration-150",
            "active:opacity-60",
            moreActive ? "text-emerald-600" : "text-gray-400",
          )}
        >
          {moreActive ? (
            <EllipsisFilled className="h-[22px] w-[22px]" />
          ) : (
            <EllipsisOutline className="h-[22px] w-[22px]" />
          )}
          <span
            className={cn(
              "text-[10px] leading-tight tracking-wide",
              moreActive
                ? "font-semibold text-emerald-600"
                : "font-medium text-gray-400",
            )}
          >
            {t("more")}
          </span>
        </button>
      </div>
    </nav>
  );
}
