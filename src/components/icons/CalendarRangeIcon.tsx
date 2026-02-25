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
        stroke="url(#calrange-gradient)"
        strokeWidth="2"
      />
      <path
        d="M16 2v4M8 2v4M3 10h18"
        stroke="url(#calrange-line-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Row of dots — day markers */}
      <circle cx="8" cy="14" r="1" fill="url(#calrange-dot-gradient)" />
      <circle cx="12" cy="14" r="1" fill="url(#calrange-dot-gradient)" />
      <circle cx="16" cy="14" r="1" fill="url(#calrange-dot-gradient)" />
      {/* Range bar */}
      <rect
        x="8"
        y="17"
        width="8"
        height="2"
        rx="1"
        fill="url(#calrange-bar-gradient)"
      />
      <defs>
        <linearGradient
          id="calrange-gradient"
          x1="3"
          y1="4"
          x2="21"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient
          id="calrange-line-gradient"
          x1="3"
          y1="2"
          x2="21"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient
          id="calrange-dot-gradient"
          x1="7"
          y1="13"
          x2="17"
          y2="15"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient
          id="calrange-bar-gradient"
          x1="8"
          y1="17"
          x2="16"
          y2="19"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}
