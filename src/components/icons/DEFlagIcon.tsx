import { type SVGProps } from "react";

/**
 * German flag icon (🇩🇪) — three horizontal stripes: black, red, gold.
 * Rounded-rect clip for a clean badge look.
 */
export function DEFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <clipPath id="de-flag-clip">
          <rect width="24" height="18" rx="3" />
        </clipPath>
      </defs>
      <g clipPath="url(#de-flag-clip)">
        <rect width="24" height="6" fill="#000000" />
        <rect y="6" width="24" height="6" fill="#DD0000" />
        <rect y="12" width="24" height="6" fill="#FFCC00" />
      </g>
      <rect
        width="24"
        height="18"
        rx="3"
        stroke="#000"
        strokeOpacity="0.08"
        strokeWidth="0.5"
        fill="none"
      />
    </svg>
  );
}
