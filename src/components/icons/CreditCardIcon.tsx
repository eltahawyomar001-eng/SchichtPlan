import { type SVGProps } from "react";

/**
 * Credit card / Billing icon with gradient stroke.
 * Matches the emerald Brand/600→Brand/400 gradient used by all sidebar icons.
 */
export function CreditCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="1"
        y="4"
        width="22"
        height="16"
        rx="3"
        stroke="url(#cc-gradient)"
        strokeWidth="2"
      />
      <line
        x1="1"
        y1="10"
        x2="23"
        y2="10"
        stroke="url(#cc-line-gradient)"
        strokeWidth="2"
      />
      <defs>
        <linearGradient
          id="cc-gradient"
          x1="1"
          y1="4"
          x2="23"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient
          id="cc-line-gradient"
          x1="1"
          y1="10"
          x2="23"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}
