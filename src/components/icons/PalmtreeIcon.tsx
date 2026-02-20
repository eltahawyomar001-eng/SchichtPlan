import { type SVGProps } from "react";

/**
 * Palm tree icon — used for Urlaubskonto (vacation balance).
 * Gradient stroke from Brand/600 (#7C3AED) to Brand/400 (#A78BFA).
 */
export function PalmtreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M13 8c0-2.76-2.46-5-5.5-5-1.84 0-3.46.96-4.34 2.4"
        stroke="url(#palm-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5.71 5.4A5.007 5.007 0 0 0 2 10c0 .28.02.56.07.83"
        stroke="url(#palm-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.29 5.4A5.007 5.007 0 0 1 20 10c0 .28-.02.56-.07.83"
        stroke="url(#palm-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 8c0-2.76 2.46-5 5.5-5 1.84 0 3.46.96 4.34 2.4"
        stroke="url(#palm-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M2.07 10.83C2.85 14.5 7 16 11 16s8.15-1.5 8.93-5.17"
        stroke="url(#palm-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m11 16 1 6"
        stroke="url(#palm-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="palm-gradient"
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
