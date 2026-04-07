import { type SVGProps } from "react";

/**
 * Award/medal icon — used for Qualifikationen (skills).
 * Gradient stroke from Brand/600 (#059669) to Brand/400 (#34d399).
 */
export function AwardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />{" "}
    </svg>
  );
}
