import { type SVGProps } from "react";

/**
 * Clock icon with gradient stroke from Brand/600 (#059669) to Brand/400 (#34d399).
 * Used in the Shiftfy brand mark and time-related UI elements.
 * Animation-ready with unique gradient ID.
 */
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
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
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 7v5l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />{" "}
    </svg>
  );
}
