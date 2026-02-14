import { type SVGProps } from "react";

/**
 * Dashboard grid icon with gradient. Used for the main dashboard nav item.
 */
export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
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
        y="3"
        width="8"
        height="8"
        rx="2"
        stroke="url(#dash-gradient)"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="3"
        width="8"
        height="8"
        rx="2"
        stroke="url(#dash-gradient)"
        strokeWidth="2"
      />
      <rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="2"
        stroke="url(#dash-gradient)"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="13"
        width="8"
        height="8"
        rx="2"
        stroke="url(#dash-gradient)"
        strokeWidth="2"
      />
      <defs>
        <linearGradient
          id="dash-gradient"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
