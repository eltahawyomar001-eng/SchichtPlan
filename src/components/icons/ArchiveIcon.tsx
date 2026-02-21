import { type SVGProps } from "react";

/** Archive / Monatsabschluss icon */
export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <polyline
        points="21 8 21 21 3 21 3 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="1"
        y="3"
        width="22"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="10"
        y1="12"
        x2="14"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
