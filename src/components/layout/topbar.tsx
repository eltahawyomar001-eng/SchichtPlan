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
}

export function Topbar({ title, description, actions }: TopbarProps) {
  const { data: session } = useSession();
  const { openSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-sm px-3 sm:px-6 py-2.5 sm:py-3.5 gap-2 sm:gap-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Mobile hamburger */}
        <button
          onClick={openSidebar}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden flex-shrink-0"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {actions}
        <LanguageSwitcher />
        <NotificationDropdown />
        {session?.user?.name && <Avatar name={session.user.name} size="sm" />}
      </div>
    </header>
  );
}
