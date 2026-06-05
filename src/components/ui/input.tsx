import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-[var(--r-sm)] border border-border bg-surface ps-4 pe-4 py-3 text-[16px] text-foreground placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-soft focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-[var(--d-fast)] shadow-[var(--sh-xs)]",
        "sm:h-10 sm:ps-3.5 sm:pe-3.5 sm:py-2 sm:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
