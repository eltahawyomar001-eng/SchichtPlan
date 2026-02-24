"use client";

import { SessionProvider } from "next-auth/react";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerProvider />
      {children}
    </SessionProvider>
  );
}
