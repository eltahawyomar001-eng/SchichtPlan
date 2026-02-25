import { type SVGProps } from "react";

/**
 * Beaker / flask icon. Used for sandbox / simulation mode indicators.
 */
export function BeakerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4.5 3h15M6 3v7.5l-4 8.5a2 2 0 0 0 1.8 2.8h16.4a2 2 0 0 0 1.8-2.8L18 10.5V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 14h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
