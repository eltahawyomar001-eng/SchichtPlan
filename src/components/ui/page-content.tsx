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
 */
export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("p-4 sm:p-6 lg:p-8 space-y-6", className)}>
      {children}
    </div>
  );
}
