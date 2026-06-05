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
import { TimeClockPopover } from "@/components/layout/time-clock-popover";
import { useTheme } from "@/components/providers/theme-provider";
import { useRouter } from "next/navigation";

interface TopbarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Hide the iOS mobile header (for pages with custom chrome) */
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
        <div className="lg:hidden pt-3">
          <div className="px-4 pb-2">
            {/* Utility row — compact, right-aligned */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <TimeClockPopover />
                <LanguageSwitcher />
                <NotificationDropdown />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-[34px] font-extrabold tracking-[-0.03em] text-foreground leading-[1.1] truncate min-w-0 flex-1">
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
              <p className="text-[15px] text-muted-foreground mt-1 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Classic desktop bar — lg+ only ── */}
      <header className="sticky top-0 z-30 hidden lg:block bg-[color-mix(in_oklab,var(--background)_78%,transparent)] backdrop-blur-xl backdrop-saturate-[1.6] px-4 sm:px-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Hairline bottom border */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />

        <div className="flex items-center justify-between py-2.5 sm:py-3 gap-2 sm:gap-3 min-h-[60px]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={openSidebar}
              aria-label="Menü öffnen"
              className="hidden rounded-[var(--r-sm)] p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-[var(--t-xl)] font-extrabold tracking-[-0.025em] text-foreground truncate leading-[1.1]">
                {title}
              </h1>
              {description && (
                <p className="text-[var(--t-sm)] text-muted-foreground truncate mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
            <TimeClockPopover />
            <LanguageSwitcher />
            <NotificationDropdown />
            {session?.user?.name && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar
                    name={session.user.name}
                    size="sm"
                    className="ring-2 ring-border cursor-pointer hover:ring-brand/40 transition-all"
                  />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-[var(--r-md)] border border-border bg-elevated shadow-[var(--sh-lg)] py-1 z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-[650] text-foreground truncate">
                        {session.user.name}
                      </p>
                      {session.user.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {session.user.email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        router.push("/einstellungen");
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                      {t("settings")}
                    </button>
                    <button
                      onClick={toggleTheme}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    >
                      {theme === "dark" ? (
                        <SunIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MoonIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      {theme === "dark" ? t("lightMode") : t("darkMode")}
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger-soft transition-colors"
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
