import { type SVGProps } from "react";

/** Shopping cart icon for retail industry */
export function ShoppingCartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
      <circle cx="19" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
      <path
        d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
