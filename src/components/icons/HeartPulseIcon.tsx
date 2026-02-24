import { type SVGProps } from "react";

/** Heart pulse icon for healthcare/nursing industry */
export function HeartPulseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 0112 6.006a5 5 0 017.5 6.566z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12h2l2 3 4-6 2 3h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
