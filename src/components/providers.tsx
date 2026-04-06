"use client";

import { SessionProvider } from "next-auth/react";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { ViewTransitionProvider } from "@/components/providers/view-transition-provider";
import { ConnectivityBanner } from "@/components/ui/connectivity-banner";
import { UpdatePrompt } from "@/components/ui/update-prompt";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <ThemeProvider>
          <ServiceWorkerProvider />
          <ViewTransitionProvider />
          <ConnectivityBanner />
          <UpdatePrompt />
          <PullToRefresh />
          {children}
        </ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
