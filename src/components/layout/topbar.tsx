"use client";

import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { MenuIcon } from "@/components/icons";
import { useSidebar } from "@/components/layout/dashboard-shell";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";

interface TopbarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Hide the iOS mobile header (for pages like nachrichten that have custom chrome) */
  hideMobile?: boolean;
}

export function Topbar({
  title,
  description,
  actions,
  hideMobile = false,
}: TopbarProps) {
  const { data: session } = useSession();
  const { openSidebar } = useSidebar();

  return (
    <>
      {/* ── iOS large title — mobile only ── */}
      {!hideMobile && (
        <div className="lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="px-4 pb-2">
            {/* Utility row */}
            <div className="flex items-center justify-end mb-1">
              <div className="flex items-center gap-1 flex-shrink-0">
                {actions}
                <LanguageSwitcher />
                <NotificationDropdown />
              </div>
            </div>
            <h1 className="text-[34px] font-bold tracking-tight text-gray-900 leading-[1.1]">
              {title}
            </h1>
            {description && (
              <p className="text-[15px] text-gray-500 mt-1">{description}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Classic desktop bar — lg+ only ── */}
      <header className="sticky top-0 z-30 hidden lg:block bg-white/70 backdrop-blur-2xl backdrop-saturate-[1.8] [-webkit-backdrop-filter:saturate(180%)_blur(20px)] px-4 sm:px-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Hairline bottom border — 0.5px like iOS */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-black/[0.06]" />

        <div className="flex items-center justify-between py-2.5 sm:py-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={openSidebar}
              aria-label="Menü öffnen"
              className="hidden rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
            <LanguageSwitcher />
            <NotificationDropdown />
            {session?.user?.name && (
              <Avatar
                name={session.user.name}
                size="sm"
                className="ring-2 ring-gray-100"
              />
            )}
          </div>
        </div>
      </header>
    </>
  );
}
