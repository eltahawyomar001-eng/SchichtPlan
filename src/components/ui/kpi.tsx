import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KPI / stat card — redesign DS (`.kpi`).
 *
 * A dashboard metric tile: tinted icon chip, uppercase label, a large
 * tabular-figures value, and an optional trend line. The value uses the
 * `.num` class (Inter Tight, tabular-nums) so digits align across cards.
 *
 * @example
 *   <Kpi
 *     icon={<ClockIcon />}
 *     tone="brand"
 *     label={t("hoursThisWeek")}
 *     value="38,5"
 *     unit="h"
 *     trend={{ direction: "up", label: "+2,1 h" }}
 *   />
 */
type KpiTone = "brand" | "amber" | "blue" | "red";

const toneClasses: Record<KpiTone, string> = {
  brand: "bg-success-soft text-brand-600 dark:text-brand-300",
  amber: "bg-warning-soft text-warning",
  blue: "bg-info-soft text-info",
  red: "bg-danger-soft text-danger",
};

export interface KpiProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  tone?: KpiTone;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small suffix after the value, e.g. a unit. */
  unit?: React.ReactNode;
  /** Optional trend indicator below the value. */
  trend?: { direction: "up" | "down"; label: React.ReactNode };
  /** Marks the value as a warning state (amber). */
  warn?: boolean;
}

export const Kpi = React.forwardRef<HTMLDivElement, KpiProps>(
  (
    {
      icon,
      tone = "brand",
      label,
      value,
      unit,
      trend,
      warn,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-[var(--r-lg)] border border-border bg-surface p-[18px] shadow-[var(--sh-sm)] transition-[border-color,box-shadow] duration-[var(--d-fast)] hover:border-border-strong hover:shadow-[var(--sh-md)]",
        className,
      )}
      {...props}
    >
      <div className="mb-3.5 flex items-center gap-2.5">
        {icon && (
          <span
            className={cn(
              "grid h-[38px] w-[38px] place-items-center rounded-[11px] [&_svg]:h-5 [&_svg]:w-5",
              toneClasses[tone],
            )}
          >
            {icon}
          </span>
        )}
        <span className="text-[var(--t-xs)] font-[650] uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "num text-[var(--t-3xl)] font-extrabold leading-none",
          warn && "text-warning",
        )}
      >
        {value}
        {unit && (
          <small className="ml-0.5 text-[var(--t-lg)] font-bold text-text-3">
            {unit}
          </small>
        )}
      </div>
      {trend && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-[var(--t-xs)] font-bold [&_svg]:h-[13px] [&_svg]:w-[13px]",
            trend.direction === "up" ? "text-success" : "text-danger",
          )}
        >
          {trend.label}
        </div>
      )}
    </div>
  ),
);
Kpi.displayName = "Kpi";
