import { type SVGProps } from "react";

/** Crossed utensils icon for gastronomy/restaurant industry */
export function UtensilsCrossedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M16 2l-4 4-1.5-1.5M17 15l5 5M2 2l10 10M7.5 7.5L2 22l9.5-9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 3l6 6-3 3-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
