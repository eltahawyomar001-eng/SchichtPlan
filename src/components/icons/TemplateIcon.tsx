import { type SVGProps } from "react";

/**
 * Template/layout icon — used for Schichtvorlagen (shift templates).
 * Gradient stroke from Brand/600 (#7C3AED) to Brand/400 (#A78BFA).
 */
export function TemplateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        width="18"
        height="7"
        x="3"
        y="3"
        rx="1"
        stroke="url(#template-gradient)"
        strokeWidth="2"
      />
      <rect
        width="9"
        height="7"
        x="3"
        y="14"
        rx="1"
        stroke="url(#template-gradient)"
        strokeWidth="2"
      />
      <rect
        width="5"
        height="7"
        x="16"
        y="14"
        rx="1"
        stroke="url(#template-gradient)"
        strokeWidth="2"
      />
      <defs>
        <linearGradient
          id="template-gradient"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
