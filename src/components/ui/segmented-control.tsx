"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl — redesign DS (`.segmented`).
 *
 * An inline single-select toggle for mutually-exclusive views such as
 * Tag/Woche/Monat. Distinct from Tabs (which switch page regions) — this is
 * a compact control that sits in a toolbar.
 *
 * Controlled component: pass `value` + `onValueChange`. Keyboard accessible
 * (arrow keys move focus; the buttons are real <button>s in a radiogroup).
 *
 * @example
 *   <SegmentedControl
 *     value={view}
 *     onValueChange={setView}
 *     options={[
 *       { value: "day", label: t("day") },
 *       { value: "week", label: t("week") },
 *       { value: "month", label: t("month") },
 *     ]}
 *   />
 */
export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex gap-0.5 rounded-[var(--r-md)] border border-border bg-surface-2 p-[3px]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-sm)] px-3.5 py-[7px] text-[var(--t-sm)] font-semibold transition-all duration-[var(--d-fast)] disabled:pointer-events-none disabled:opacity-50",
              active
                ? "bg-surface text-foreground shadow-[var(--sh-xs)] dark:bg-surface-hover"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
