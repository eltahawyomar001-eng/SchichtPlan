import { type SVGProps } from "react";

/**
 * Shiftfy brand mark — premium logomark.
 *
 * A rounded-square container with the brand gradient, housing a stylised "S"
 * formed by two interlocking arrow-like shift bars. The negative-space gap
 * between bars hints at a clock-hand angle (≈ 10:10), while the two bars
 * evoke shift handover / schedule swap — the product's core concept.
 *
 * Design principles:
 *  • Optically centred within a 40 × 40 grid (10 rx for super-ellipse feel)
 *  • Minimum 2 px stroke equiv. at 40 px — legible down to 16 px favicon
 *  • Single gradient def shared across instances via deterministic id
 *  • No hairlines — all shapes are filled, not stroked
 */
export function ShiftfyMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id="shiftfy-bg"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient
          id="shiftfy-shine"
          x1="0"
          y1="0"
          x2="20"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.15" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background — super-ellipse */}
      <rect width="40" height="40" rx="10" fill="url(#shiftfy-bg)" />

      {/* Subtle top-left gloss for depth */}
      <rect width="40" height="40" rx="10" fill="url(#shiftfy-shine)" />

      {/*
        S-shape built from two shift bars:
        Bar 1 (upper-left → centre): left-aligned bar curving right
        Bar 2 (centre → lower-right): right-aligned bar curving left
        Together they form a stylised "S" / schedule-swap icon.
      */}

      {/* Upper bar — left-aligned, rounded ends */}
      <rect x="10" y="10" width="14" height="5" rx="2.5" fill="white" />

      {/* Middle bar — centred, slightly wider for visual weight */}
      <rect
        x="13"
        y="17.5"
        width="14"
        height="5"
        rx="2.5"
        fill="white"
        fillOpacity="0.85"
      />

      {/* Lower bar — right-aligned */}
      <rect x="16" y="25" width="14" height="5" rx="2.5" fill="white" />

      {/* Clock-hand accent — small dot at 2 o'clock position */}
      <circle cx="31" cy="11" r="1.8" fill="white" fillOpacity="0.6" />
    </svg>
  );
}
