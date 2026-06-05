"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { InstallPwaPrompt } from "@/components/layout/install-pwa-prompt";
import { PlanLimitProvider } from "@/components/providers/plan-limit-provider";
import { CommandPalette } from "@/components/ui/command-palette";
import { OnboardingTour } from "@/components/ui/onboarding-tour";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { TrialBanner } from "@/components/layout/trial-banner";
import { OfflineSyncBanner } from "@/components/layout/offline-sync-banner";
import { FeedbackWidget } from "@/components/layout/feedback-widget";
import { TosAcceptanceModal } from "@/components/layout/tos-acceptance-modal";

interface SidebarContextValue {
  openSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  openSidebar: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useIdleTimeout();

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <SidebarContext.Provider value={{ openSidebar }}>
      <PlanLimitProvider>
        <div className="min-h-[100dvh] bg-dashboard">
          {/* Skip-to-content link for keyboard/screen-reader users (BFSG/WCAG 2.1) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-[var(--r-sm)] focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-brand focus:shadow-[var(--sh-lg)] focus:outline-none"
          >
            Zum Inhalt springen
          </a>
          {/* Top banners — offset by sidebar width on desktop so the
              fixed sidebar doesn't clip the start of the banner text. */}
          <div className="lg:pl-[var(--sidebar-width,16rem)]">
            <TrialBanner />
            <OfflineSyncBanner />
          </div>
          <Sidebar open={sidebarOpen} onClose={closeSidebar} />
          <main
            id="main-content"
            // --sidebar-width is published by the Sidebar on document root.
            // Falls back to 16rem (the original w-64 default).
            className="lg:pl-[var(--sidebar-width,16rem)] min-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] overflow-x-hidden"
          >
            {children}
          </main>
          {/* Mobile bottom tab bar — visible only on mobile */}
          <MobileBottomNav onMoreTap={openSidebar} />
          <CommandPalette />
          <OnboardingTour />
          <InstallPwaPrompt />
          <FeedbackWidget />
          <TosAcceptanceModal />
        </div>
      </PlanLimitProvider>
    </SidebarContext.Provider>
  );
}
