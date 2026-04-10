import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 ps-4 pe-4 py-3 text-[16px] text-gray-900 dark:text-zinc-100 transition-all duration-150 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50",
      "sm:h-10 sm:ps-3.5 sm:pe-3.5 sm:py-2 sm:text-sm",
      "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M6%208.825c-.2%200-.4-.1-.5-.2l-3.5-3.5c-.3-.3-.3-.8%200-1.1s.8-.3%201.1%200L6%206.925l2.9-2.9c.3-.3.8-.3%201.1%200s.3.8%200%201.1l-3.5%203.5c-.1.1-.3.2-.5.2z%22%2F%3E%3C%2Fsvg%3E')] dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2371717a%22%20d%3D%22M6%208.825c-.2%200-.4-.1-.5-.2l-3.5-3.5c-.3-.3-.3-.8%200-1.1s.8-.3%201.1%200L6%206.925l2.9-2.9c.3-.3.8-.3%201.1%200s.3.8%200%201.1l-3.5%203.5c-.1.1-.3.2-.5.2z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pe-9",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
