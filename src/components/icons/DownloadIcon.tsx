import type { SVGProps } from "react";

/**
 * Download icon with gradient. Used for export/download actions.
 */
export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        stroke="url(#download-gradient)"
      />
      <polyline points="7 10 12 15 17 10" stroke="url(#download-gradient)" />
      <line x1="12" y1="15" x2="12" y2="3" stroke="url(#download-gradient)" />
      <defs>
        <linearGradient
          id="download-gradient"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
