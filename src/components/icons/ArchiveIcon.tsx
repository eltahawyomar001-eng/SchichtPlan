import { type SVGProps } from "react";

/** Archive / Monatsabschluss icon */
export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <polyline
        points="21 8 21 21 3 21 3 8"
        stroke="url(#archive-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="1"
        y="3"
        width="22"
        height="5"
        rx="1"
        stroke="url(#archive-gradient)"
        strokeWidth="2"
      />
      <line
        x1="10"
        y1="12"
        x2="14"
        y2="12"
        stroke="url(#archive-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="archive-gradient"
          x1="1"
          y1="3"
          x2="23"
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
