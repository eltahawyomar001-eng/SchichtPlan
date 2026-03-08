import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContentProps {
  children: React.ReactNode;
  /** Extra class names (e.g. max-w-3xl) */
  className?: string;
}

/**
 * Standard content wrapper for dashboard pages.
 * Provides consistent responsive padding and vertical spacing.
 * Uses Apple HIG / Material 3 spacing: 16px mobile, 24px tablet, 32px desktop.
 */
export function PageContent({ children, className }: PageContentProps) {
  return (
    <div
      className={cn("p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden", className)}
    >
      {children}
    </div>
  );
}
