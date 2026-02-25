"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { InstallPwaPrompt } from "@/components/layout/install-pwa-prompt";
import { PlanLimitProvider } from "@/components/providers/plan-limit-provider";

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

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <SidebarContext.Provider value={{ openSidebar }}>
      <PlanLimitProvider>
        <div className="min-h-screen bg-dashboard">
          {/* Skip-to-content link for keyboard/screen-reader users (BFSG/WCAG 2.1) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
          >
            Zum Inhalt springen
          </a>
          <Sidebar open={sidebarOpen} onClose={closeSidebar} />
          <main
            id="main-content"
            className="lg:pl-64 min-h-screen pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
          >
            {children}
          </main>
          <InstallPwaPrompt />
        </div>
      </PlanLimitProvider>
    </SidebarContext.Provider>
  );
}
