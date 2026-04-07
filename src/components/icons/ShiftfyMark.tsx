import { type SVGProps } from "react";

/**
 * Shiftfy brand mark — premium B2B logomark.
 *
 * An abstract "S" monogram built from two flowing, interlocking chevron
 * shapes. The top chevron sweeps right-to-left; the bottom sweeps
 * left-to-right. Together they form:
 *  - A stylised "S" for Shiftfy
 *  - Two arrows exchanging direction = shift handover
 *  - A continuous flow loop = seamless scheduling
 *
 * The mark sits inside a rounded-square (super-ellipse) container with
 * the brand gradient. The "S" is constructed from two thick rounded
 * paths with a deliberate negative-space gap between them.
 *
 * Design principles:
 *  - 40 x 40 grid, 10 rx super-ellipse
 *  - Bold 4 px stroke weight at 40 px -- reads clearly at 16 px
 *  - No literal clocks, calendars, or generic icons
 *  - Distinctive, ownable shape that works as a brand asset
 *  - Professional geometric aesthetic for German B2B market
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
      {/* Background */}
      <rect width="40" height="40" rx="10" fill="url(#shiftfy-bg)" />

      {/*
        "S" monogram from two interlocking chevron-flow shapes.

        Upper chevron: starts left, curves through centre, exits right.
        Lower chevron: starts right, curves through centre, exits left.
        Gap between them creates the "S" negative space.

        Paths are designed so the two strokes interlock at the centre,
        giving depth and the feeling of two shifts overlapping.
      */}

      {/* Upper flow — sweeps from upper-left to mid-right */}
      <path
        d="M10 12 C10 12, 16 12, 20 17 C24 22, 30 18, 30 18"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Lower flow — sweeps from lower-right to mid-left */}
      <path
        d="M30 28 C30 28, 24 28, 20 23 C16 18, 10 22, 10 22"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Small arrow tips to reinforce directionality */}
      {/* Right arrow tip on upper flow */}
      <path
        d="M27 16 L30.5 18 L27.5 20"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.85"
      />

      {/* Left arrow tip on lower flow */}
      <path
        d="M13 20 L9.5 22 L12.5 24"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.85"
      />
    </svg>
  );
}
