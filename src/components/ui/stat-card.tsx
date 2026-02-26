import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  /** Icon element — rendered inside a gradient circle */
  icon: React.ReactNode;
  /** Color theme for the icon background */
  color?: "emerald" | "amber" | "blue" | "purple" | "red";
  /** Main metric value (e.g. "42", "128h") */
  value: string | number;
  /** Descriptive label below the value */
  label: string;
  /** Optional extra class names */
  className?: string;
}

const colorMap = {
  emerald: "stat-icon-emerald",
  amber: "stat-icon-amber",
  blue: "stat-icon-blue",
  purple: "stat-icon-purple",
  red: "bg-gradient-to-br from-red-50 to-red-100",
};

/**
 * Summary stat card — used at the top of list pages for KPIs.
 * Consistent icon circle + value + label layout.
 *
 * Usage:
 *   <StatCard
 *     icon={<ClockIcon className="h-5 w-5 text-emerald-600" />}
 *     color="emerald"
 *     value="128h"
 *     label="Gesamtstunden"
 *   />
 */
export function StatCard({
  icon,
  color = "emerald",
  value,
  label,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 sm:gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums leading-tight">
          {value}
        </p>
        <p className="text-xs sm:text-sm text-gray-500 leading-snug truncate">
          {label}
        </p>
      </div>
    </div>
  );
}
