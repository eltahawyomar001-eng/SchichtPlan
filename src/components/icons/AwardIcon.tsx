import { type SVGProps } from "react";

/**
 * Award/medal icon — used for Qualifikationen (skills).
 * Gradient stroke from Brand/600 (#7C3AED) to Brand/400 (#A78BFA).
 */
export function AwardIcon(props: SVGProps<SVGSVGElement>) {
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
        cy="8"
        r="6"
        stroke="url(#award-gradient)"
        strokeWidth="2"
      />
      <path
        d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"
        stroke="url(#award-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="award-gradient"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
