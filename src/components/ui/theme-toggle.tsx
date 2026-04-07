"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Standalone dark/light mode toggle button.
 * Designed to be dropped into any navbar — public or authenticated.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren"}
      title={isDark ? "Hellmodus" : "Dunkelmodus"}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
        "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
        className,
      )}
    >
      {/* Sun icon — shown in dark mode (click to go light) */}
      <svg
        className={cn(
          "h-[18px] w-[18px] transition-all",
          isDark ? "scale-100 rotate-0" : "scale-0 -rotate-90",
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      {/* Moon icon — shown in light mode (click to go dark) */}
      <svg
        className={cn(
          "absolute h-[18px] w-[18px] transition-all",
          isDark ? "scale-0 rotate-90" : "scale-100 rotate-0",
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}

export default ThemeToggle;
