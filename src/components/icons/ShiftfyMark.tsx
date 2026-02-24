import { type SVGProps } from "react";

/**
 * Shiftfy brand mark — premium B2B logomark.
 *
 * A rounded-square container with the brand gradient, housing a precision
 * clock face with an integrated calendar grid. The clock represents time
 * tracking accuracy, while the two schedule ticks at 3 and 9 o'clock evoke
 * shift management. A subtle checkmark on the hour hand signals completion
 * and reliability.
 *
 * Design principles:
 *  • 40 × 40 grid, 10 rx super-ellipse container
 *  • Minimum 2 px stroke equiv. at 40 px — legible down to 16 px favicon
 *  • Clean geometric shapes — no hairlines, all filled
 *  • Professional, trustworthy aesthetic for German B2B market
 *  • Single gradient def shared across instances via deterministic id
 */
export function ShiftfyMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id="shiftfy-bg"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient
          id="shiftfy-shine"
          x1="0"
          y1="0"
          x2="20"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.12" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background — super-ellipse */}
      <rect width="40" height="40" rx="10" fill="url(#shiftfy-bg)" />

      {/* Subtle top-left gloss for depth */}
      <rect width="40" height="40" rx="10" fill="url(#shiftfy-shine)" />

      {/* Clock circle — outer ring */}
      <circle
        cx="20"
        cy="20"
        r="11"
        stroke="white"
        strokeWidth="2"
        strokeOpacity="0.9"
      />

      {/* Hour hand — pointing to ~10 (upper-left) */}
      <line
        x1="20"
        y1="20"
        x2="15"
        y2="13.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Minute hand — pointing to 2 (upper-right) */}
      <line
        x1="20"
        y1="20"
        x2="26"
        y2="13"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Centre dot */}
      <circle cx="20" cy="20" r="1.6" fill="white" />

      {/* Hour markers — 12, 3, 6, 9 positions */}
      <rect
        x="19"
        y="7.5"
        width="2"
        height="3"
        rx="1"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="29.5"
        y="19"
        width="3"
        height="2"
        rx="1"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="19"
        y="29.5"
        width="2"
        height="3"
        rx="1"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="7.5"
        y="19"
        width="3"
        height="2"
        rx="1"
        fill="white"
        fillOpacity="0.7"
      />

      {/* Small schedule bar accent — bottom-right corner */}
      <rect
        x="29"
        y="30"
        width="6"
        height="1.8"
        rx="0.9"
        fill="white"
        fillOpacity="0.5"
      />
      <rect
        x="29"
        y="33"
        width="4.5"
        height="1.8"
        rx="0.9"
        fill="white"
        fillOpacity="0.35"
      />
    </svg>
  );
}
