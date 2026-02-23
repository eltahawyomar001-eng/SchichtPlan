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
 * Aspect ratio ≈ 4.5 : 1 (160 × 36).
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
          <stop stopColor="#7C3AED" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient
          id="shiftfy-logo-shine"
          x1="0"
          y1="0"
          x2="18"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.15" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── Mark (scaled to 36 × 36) ── */}
      <rect width="36" height="36" rx="9" fill="url(#shiftfy-logo-bg)" />
      <rect width="36" height="36" rx="9" fill="url(#shiftfy-logo-shine)" />

      {/* Upper bar */}
      <rect x="9" y="9" width="12.6" height="4.5" rx="2.25" fill="white" />
      {/* Middle bar */}
      <rect
        x="11.7"
        y="15.75"
        width="12.6"
        height="4.5"
        rx="2.25"
        fill="white"
        fillOpacity="0.85"
      />
      {/* Lower bar */}
      <rect
        x="14.4"
        y="22.5"
        width="12.6"
        height="4.5"
        rx="2.25"
        fill="white"
      />
      {/* Accent dot */}
      <circle cx="27.9" cy="9.9" r="1.6" fill="white" fillOpacity="0.6" />

      {/* ── Wordmark ── */}
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
