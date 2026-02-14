import { type SVGProps } from "react";

/**
 * Calendar icon with gradient fill. Used for shift scheduling sections.
 * Animation-ready — path elements can be targeted individually.
 */
export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
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
        stroke="url(#calendar-gradient)"
        strokeWidth="2"
      />
      <path
        d="M16 2v4M8 2v4M3 10h18"
        stroke="url(#calendar-line-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="15" r="1" fill="url(#calendar-dot-gradient)" />
      <circle cx="12" cy="15" r="1" fill="url(#calendar-dot-gradient)" />
      <circle cx="16" cy="15" r="1" fill="url(#calendar-dot-gradient)" />
      <defs>
        <linearGradient
          id="calendar-gradient"
          x1="3"
          y1="4"
          x2="21"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient
          id="calendar-line-gradient"
          x1="3"
          y1="2"
          x2="21"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient
          id="calendar-dot-gradient"
          x1="7"
          y1="14"
          x2="17"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
