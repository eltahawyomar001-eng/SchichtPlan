import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ children, className }: TabsProps) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-gray-100/80 p-1 shadow-inner",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function TabsTrigger({
  active,
  onClick,
  children,
  className,
}: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150",
        active
          ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50"
          : "text-gray-500 hover:text-gray-700 hover:bg-white/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export { Tabs, TabsList, TabsTrigger };
