import { type SVGProps } from "react";

/**
 * Dashboard grid icon with gradient. Used for the main dashboard nav item.
 */
export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="3"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="13"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />{" "}
    </svg>
  );
}
