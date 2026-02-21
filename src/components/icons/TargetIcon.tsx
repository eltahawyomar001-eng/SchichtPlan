import { type SVGProps } from "react";

/** Target / Stempeluhr (punch clock) icon with gradient */
export function TargetIcon(props: SVGProps<SVGSVGElement>) {
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
        r="10"
        stroke="url(#target-gradient)"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="url(#target-gradient)"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        stroke="url(#target-gradient)"
        strokeWidth="2"
      />
      <defs>
        <linearGradient
          id="target-gradient"
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
