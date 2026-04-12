import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTime(time: string): string {
  return time.replace(":", ":") + " Uhr";
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Format a number with locale-aware decimal separator.
 * German: 8,50  English: 8.50
 */
export function fmtNum(
  value: number,
  decimals: number = 2,
  locale: string = "de",
): string {
  return value.toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
