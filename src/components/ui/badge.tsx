import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Redesign DS badges — soft tinted fills keyed to the semantic tokens.
   Variant names are unchanged (API parity); only the styling moves to
   token-based utilities so light/dark track the design system. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors max-w-full truncate whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-success-soft text-brand-strong ring-1 ring-brand/15",
        success: "bg-success-soft text-success ring-1 ring-success/15",
        info: "bg-info-soft text-info ring-1 ring-info/15",
        warning: "bg-warning-soft text-warning ring-1 ring-warning/15",
        destructive: "bg-danger-soft text-danger ring-1 ring-danger/15",
        outline: "border border-border text-muted-foreground bg-surface",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
