import { type SVGProps } from "react";

/**
 * Annual-planning / calendar-range icon with gradient stroke.
 * Matches the emerald Brand/600→Brand/400 gradient used by all sidebar icons.
 */
export function CalendarRangeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 2v4M8 2v4M3 10h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Row of dots — day markers */}
      <circle cx="8" cy="14" r="1" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
      {/* Range bar */}
      <rect x="8" y="17" width="8" height="2" rx="1" fill="currentColor" />{" "}
    </svg>
  );
}
