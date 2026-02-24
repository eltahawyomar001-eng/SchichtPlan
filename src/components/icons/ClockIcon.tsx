import { type SVGProps } from "react";

/**
 * Clock icon with gradient stroke from Brand/600 (#059669) to Brand/400 (#34d399).
 * Used in the Shiftfy brand mark and time-related UI elements.
 * Animation-ready with unique gradient ID.
 */
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="url(#clock-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 7v5l3 3"
        stroke="url(#clock-hand-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="clock-gradient"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient
          id="clock-hand-gradient"
          x1="12"
          y1="7"
          x2="15"
          y2="15"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}
