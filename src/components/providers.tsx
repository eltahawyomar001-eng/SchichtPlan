"use client";

import { SessionProvider } from "next-auth/react";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { QueryProvider } from "@/components/providers/query-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <ServiceWorkerProvider />
        {children}
      </QueryProvider>
    </SessionProvider>
  );
}
