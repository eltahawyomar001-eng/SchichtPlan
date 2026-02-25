import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
        success: "bg-green-50 text-green-700 ring-1 ring-green-200/50",
        warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
        destructive: "bg-red-50 text-red-700 ring-1 ring-red-200/50",
        outline: "border border-gray-200 text-gray-600 bg-white",
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
