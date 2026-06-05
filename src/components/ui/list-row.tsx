import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ListRow — redesign DS (`.row`).
 *
 * The standard tappable list item: optional leading slot (avatar/icon), a
 * title + subtitle stack that grows, an optional trailing slot, and an
 * optional chevron affordance. Renders as a <button> when `onClick` is set
 * (keyboard-accessible) or a <div> otherwise.
 *
 * Consecutive ListRows space themselves automatically.
 *
 * @example
 *   <ListRow
 *     leading={<Avatar … />}
 *     title="Anna Becker"
 *     subtitle="Frühschicht · 06:00–14:00"
 *     trailing={<Badge>Bestätigt</Badge>}
 *     onClick={() => open(id)}
 *   />
 */
export interface ListRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Show a chevron at the end (implies navigational). */
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
}

const ChevronRight = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
    className="h-[18px] w-[18px]"
  >
    <path
      d="m9 6 6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ListRow = React.forwardRef<HTMLElement, ListRowProps>(
  (
    { leading, title, subtitle, trailing, chevron, onClick, className },
    ref,
  ) => {
    const interactive = typeof onClick === "function";
    const Comp = interactive ? "button" : "div";
    return (
      <Comp
        // @ts-expect-error — polymorphic ref across button/div
        ref={ref}
        type={interactive ? "button" : undefined}
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-[var(--r-md)] border border-border bg-surface p-3.5 text-start transition-all duration-[var(--d-fast)] [&+&]:mt-2.5",
          interactive &&
            "cursor-pointer hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-soft",
          className,
        )}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[var(--t-base)] font-[650] text-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[var(--t-sm)] text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        {trailing}
        {chevron && (
          <span className="flex-shrink-0 text-text-3">
            <ChevronRight />
          </span>
        )}
      </Comp>
    );
  },
);
ListRow.displayName = "ListRow";
