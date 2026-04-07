import { type SVGProps } from "react";

/**
 * Bar chart icon with gradient. Used for analytics/reporting sections.
 */
export function BarChartIcon(props: SVGProps<SVGSVGElement>) {
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
        y="12"
        width="4"
        height="9"
        rx="1"
        fill="currentColor"
        fillOpacity="0.3"
      />
      <rect
        x="10"
        y="7"
        width="4"
        height="14"
        rx="1"
        fill="currentColor"
        fillOpacity="0.6"
      />
      <rect
        x="17"
        y="3"
        width="4"
        height="18"
        rx="1"
        fill="currentColor"
      />{" "}
    </svg>
  );
}
