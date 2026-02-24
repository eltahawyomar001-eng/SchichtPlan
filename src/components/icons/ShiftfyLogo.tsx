import { type SVGProps } from "react";

/**
 * Shiftfy full logo — mark + wordmark in a single SVG.
 *
 * Usage: <ShiftfyLogo className="h-8 w-auto" />
 *
 * The wordmark uses the Inter/system font stack via a <text> element so it
 * matches the rest of the UI. If you need a fully self-contained SVG
 * (e.g. for emails or OG images), convert the text to outlines.
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
          <stop stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient
          id="shiftfy-logo-shine"
          x1="0"
          y1="0"
          x2="18"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.12" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* -- Mark (scaled to 36 x 36) -- */}
      <rect width="36" height="36" rx="9" fill="url(#shiftfy-logo-bg)" />
      <rect width="36" height="36" rx="9" fill="url(#shiftfy-logo-shine)" />

      {/* Clock circle */}
      <circle
        cx="18"
        cy="18"
        r="9.9"
        stroke="white"
        strokeWidth="1.8"
        strokeOpacity="0.9"
      />

      {/* Hour hand — ~10 o'clock */}
      <line
        x1="18"
        y1="18"
        x2="13.5"
        y2="12.2"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Minute hand — ~2 o'clock */}
      <line
        x1="18"
        y1="18"
        x2="23.4"
        y2="11.7"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Centre dot */}
      <circle cx="18" cy="18" r="1.4" fill="white" />

      {/* Hour markers */}
      <rect
        x="17.1"
        y="6.8"
        width="1.8"
        height="2.7"
        rx="0.9"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="26.5"
        y="17.1"
        width="2.7"
        height="1.8"
        rx="0.9"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="17.1"
        y="26.5"
        width="1.8"
        height="2.7"
        rx="0.9"
        fill="white"
        fillOpacity="0.7"
      />
      <rect
        x="6.8"
        y="17.1"
        width="2.7"
        height="1.8"
        rx="0.9"
        fill="white"
        fillOpacity="0.7"
      />

      {/* Schedule bar accent */}
      <rect
        x="26.1"
        y="27"
        width="5.4"
        height="1.6"
        rx="0.8"
        fill="white"
        fillOpacity="0.5"
      />
      <rect
        x="26.1"
        y="29.7"
        width="4"
        height="1.6"
        rx="0.8"
        fill="white"
        fillOpacity="0.35"
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
