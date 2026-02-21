import { type SVGProps } from "react";

/** Credit card / Billing icon */
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
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="1"
        y1="10"
        x2="23"
        y2="10"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
