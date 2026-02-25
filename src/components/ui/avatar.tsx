import * as React from "react";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({
  name,
  color = "#10b981",
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const parts = name.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts[parts.length - 1] || "";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white shadow-sm",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: color }}
      {...props}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}
