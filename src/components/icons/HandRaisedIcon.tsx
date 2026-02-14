import { type SVGProps } from "react";

/**
 * Raised hand icon — used for Verfügbarkeiten (availability management).
 * Gradient stroke from Brand/600 (#7C3AED) to Brand/400 (#A78BFA).
 */
export function HandRaisedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M18 8V6a2 2 0 0 0-4 0v1M14 7V4a2 2 0 0 0-4 0v3M10 7V5a2 2 0 0 0-4 0v5"
        stroke="url(#hand-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 8a2 2 0 0 1 2 2v1c0 5-3 8-7 9H9c-2 0-3-1-3-3v-7l1.5-2a1 1 0 0 1 1.7.3L10 10V5"
        stroke="url(#hand-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="hand-gradient"
          x1="6"
          y1="4"
          x2="20"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
