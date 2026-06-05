import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-sm)] text-sm font-semibold transition-all duration-[var(--d-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97] min-h-[44px] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-brand-600 to-brand-500 text-on-brand shadow-[var(--sh-sm)] hover:shadow-[var(--sh-brand)] hover:brightness-105 active:brightness-95",
        destructive:
          "bg-danger text-on-brand hover:brightness-110 shadow-[var(--sh-sm)]",
        outline:
          "border border-border bg-surface hover:bg-surface-hover text-foreground shadow-[var(--sh-xs)] hover:shadow-[var(--sh-sm)]",
        secondary:
          "bg-surface-2 text-foreground hover:bg-surface-hover border border-border shadow-[var(--sh-xs)]",
        ghost: "hover:bg-surface-hover text-muted-foreground",
        link: "text-brand hover:underline underline-offset-4 min-h-0",
      },
      size: {
        default: "h-12 px-5 py-3 text-base sm:h-10 sm:py-2 sm:text-sm",
        sm: "h-11 rounded-[var(--r-xs)] px-3.5 text-sm sm:h-9 sm:text-xs",
        lg: "h-12 rounded-[var(--r-md)] px-8 sm:h-11",
        icon: "h-12 w-12 sm:h-10 sm:w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
