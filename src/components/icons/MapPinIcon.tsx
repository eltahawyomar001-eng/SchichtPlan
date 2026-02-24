import { type SVGProps } from "react";

/**
 * Map pin icon with gradient. Used for location/standort sections.
 * Animation-ready — pin and dot are separate path elements.
 */
export function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke="url(#mappin-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="10"
        r="3"
        stroke="url(#mappin-gradient)"
        strokeWidth="2"
      />
      <defs>
        <linearGradient
          id="mappin-gradient"
          x1="3"
          y1="1"
          x2="21"
          y2="23"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}
