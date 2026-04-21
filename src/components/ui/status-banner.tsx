"use client";

/**
 * Accessible, dismissible status banner used inline on forms.
 *
 * - `role="status"` + `aria-live="polite"` for success (non-disruptive)
 * - `role="alert"`  + `aria-live="assertive"` for errors (screen-reader announces)
 * - Optional dismiss (X) button when `onDismiss` is provided.
 *
 * For transient feedback (auto-dismiss), prefer the global Sonner toaster.
 * This component is intended for form-scoped persistent feedback.
 */

import { useTranslations } from "next-intl";
import { XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type StatusBannerType = "success" | "error" | "warning" | "info";

interface StatusBannerProps {
  type: StatusBannerType;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  /** Optional label for the dismiss button (defaults to a sensible string). */
  dismissLabel?: string;
}

const STYLES: Record<StatusBannerType, string> = {
  success:
    "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900",
  error:
    "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
  info: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
};

export function StatusBanner({
  type,
  children,
  onDismiss,
  className,
  dismissLabel,
}: StatusBannerProps) {
  const t = useTranslations("common");
  const isError = type === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm",
        STYLES[type],
        className,
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? t("close")}
          className="flex-shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
