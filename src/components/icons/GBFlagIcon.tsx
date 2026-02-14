import { type SVGProps } from "react";

/**
 * United Kingdom flag icon (🇬🇧) — Union Jack.
 * Rounded-rect clip for a clean badge look.
 */
export function GBFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <clipPath id="gb-flag-clip">
          <rect width="24" height="18" rx="3" />
        </clipPath>
      </defs>
      <g clipPath="url(#gb-flag-clip)">
        {/* Blue background */}
        <rect width="24" height="18" fill="#012169" />
        {/* White diagonal cross */}
        <path d="M0 0L24 18M24 0L0 18" stroke="#FFF" strokeWidth="3.6" />
        {/* Red diagonal cross (St Patrick + St Andrew offset) */}
        <path d="M0 0L24 18" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M24 0L0 18" stroke="#C8102E" strokeWidth="1.2" />
        {/* White vertical/horizontal cross */}
        <path d="M12 0V18M0 9H24" stroke="#FFF" strokeWidth="4.8" />
        {/* Red vertical/horizontal cross (St George) */}
        <path d="M12 0V18M0 9H24" stroke="#C8102E" strokeWidth="2.4" />
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
