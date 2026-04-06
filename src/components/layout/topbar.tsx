"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import {
  MenuIcon,
  LogOutIcon,
  SettingsIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";
import { useSidebar } from "@/components/layout/dashboard-shell";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { useTheme } from "@/components/providers/theme-provider";
import { useRouter } from "next/navigation";

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
  const t = useTranslations("nav");
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [profileOpen]);

  return (
    <>
      {/* ── iOS large title — mobile only ── */}
      {!hideMobile && (
        <div className="lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="px-4 pb-2">
            {/* Utility row — compact, right-aligned */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <LanguageSwitcher />
                <NotificationDropdown />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-[34px] font-bold tracking-tight text-gray-900 dark:text-zinc-100 leading-[1.1] truncate min-w-0 flex-1">
                {title}
              </h1>
              {/* Page-specific actions inline with title */}
              {actions && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {actions}
                </div>
              )}
            </div>
            {description && (
              <p className="text-[15px] text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Classic desktop bar — lg+ only ── */}
      <header className="sticky top-0 z-30 hidden lg:block bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl backdrop-saturate-[1.8] [-webkit-backdrop-filter:saturate(180%)_blur(20px)] px-4 sm:px-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Hairline bottom border — 0.5px like iOS */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-black/[0.06] dark:bg-white/[0.08]" />

        <div className="flex items-center justify-between py-2.5 sm:py-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={openSidebar}
              aria-label="Menü öffnen"
              className="hidden rounded-xl p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 truncate">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-gray-500 dark:text-zinc-400 truncate mt-0.5">
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
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Avatar
                    name={session.user.name}
                    size="sm"
                    className="ring-2 ring-gray-100 dark:ring-zinc-700 cursor-pointer hover:ring-emerald-200 dark:hover:ring-emerald-800 transition-all"
                  />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                        {session.user.name}
                      </p>
                      {session.user.email && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                          {session.user.email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        router.push("/einstellungen");
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <SettingsIcon className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                      {t("settings")}
                    </button>
                    <button
                      onClick={toggleTheme}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {theme === "dark" ? (
                        <SunIcon className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                      ) : (
                        <MoonIcon className="h-4 w-4 text-gray-400" />
                      )}
                      {theme === "dark" ? t("lightMode") : t("darkMode")}
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
