import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97] min-h-[44px] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:brightness-105 active:brightness-95",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-[var(--shadow-sm)]",
        outline:
          "border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]",
        secondary:
          "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-700 shadow-[var(--shadow-xs)]",
        ghost:
          "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300",
        link: "text-emerald-600 dark:text-emerald-400 underline-offset-4 hover:underline min-h-0",
      },
      size: {
        default: "h-12 px-5 py-3 text-base sm:h-10 sm:py-2 sm:text-sm",
        sm: "h-11 rounded-lg px-3.5 text-sm sm:h-9 sm:text-xs",
        lg: "h-12 rounded-xl px-8 sm:h-11",
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
