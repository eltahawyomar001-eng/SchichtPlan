import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ProgressBar — redesign DS (`.track`).
 *
 * A thin, rounded determinate progress track. `value` is clamped to 0–100.
 * Exposes the proper ARIA progressbar semantics. The fill tone can switch to
 * a semantic color (e.g. amber when nearing a limit).
 *
 * @example
 *   <ProgressBar value={72} tone="warning" aria-label={t("seatUsage")} />
 */
type ProgressTone = "brand" | "success" | "warning" | "danger";

const toneClasses: Record<ProgressTone, string> = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface ProgressBarProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "role"
> {
  value: number;
  tone?: ProgressTone;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, tone = "brand", className, ...props }, ref) => {
    const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "h-2 overflow-hidden rounded-full bg-surface-2",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-[var(--d-slow)] ease-[var(--e-out)]",
            toneClasses[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";
