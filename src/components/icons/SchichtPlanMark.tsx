import { type SVGProps } from "react";

/**
 * SchichtPlan brand mark — abstract clock/calendar hybrid.
 * Features gradient fills from brand purple (#7C3AED) to lighter purple (#A78BFA).
 * Animation-ready with separate path elements for the clock face and calendar grid.
 */
export function SchichtPlanMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill="url(#mark-bg-gradient)" />
      {/* Clock circle */}
      <circle
        cx="20"
        cy="20"
        r="10"
        stroke="white"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      {/* Clock hands */}
      <path
        d="M20 14v6l4 4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top dots — calendar indicators */}
      <circle cx="14" cy="8" r="1.5" fill="white" fillOpacity="0.7" />
      <circle cx="20" cy="8" r="1.5" fill="white" fillOpacity="0.7" />
      <circle cx="26" cy="8" r="1.5" fill="white" fillOpacity="0.7" />
      <defs>
        <linearGradient
          id="mark-bg-gradient"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
