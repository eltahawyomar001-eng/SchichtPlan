import { type SVGProps } from "react";

/**
 * Shiftfy full logo — mark + wordmark in a single SVG.
 *
 * Usage: <ShiftfyLogo className="h-8 w-auto" />
 *
 * The mark is the abstract "S" monogram (two interlocking flow arrows).
 * The wordmark uses the Inter/system font stack via a <text> element.
 *
 * Aspect ratio ~ 4.5 : 1 (160 x 36).
 */
export function ShiftfyLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 160 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Shiftfy"
      role="img"
      {...props}
    >
      <defs>
        <linearGradient
          id="shiftfy-logo-bg"
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1E40AF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* -- Mark (scaled to 36 x 36) -- */}
      <rect width="36" height="36" rx="9" fill="url(#shiftfy-logo-bg)" />

      {/* Upper flow */}
      <path
        d="M9 10.8 C9 10.8, 14.4 10.8, 18 15.3 C21.6 19.8, 27 16.2, 27 16.2"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Lower flow */}
      <path
        d="M27 25.2 C27 25.2, 21.6 25.2, 18 20.7 C14.4 16.2, 9 19.8, 9 19.8"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Right arrow tip */}
      <path
        d="M24.3 14.4 L27.5 16.2 L24.8 18"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.85"
      />

      {/* Left arrow tip */}
      <path
        d="M11.7 18 L8.5 19.8 L11.2 21.6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.85"
      />

      {/* -- Wordmark -- */}
      <text
        x="44"
        y="25"
        fill="#111827"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="22"
        fontWeight="700"
        letterSpacing="-0.02em"
      >
        Shiftfy
      </text>
    </svg>
  );
}
