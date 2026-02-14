import { type SVGProps } from "react";

/**
 * Play button icon with gradient fill. Used for video CTA.
 */
export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="url(#play-gradient)"
        strokeWidth="2"
      />
      <path d="M10 8l6 4-6 4V8z" fill="url(#play-gradient)" />
      <defs>
        <linearGradient
          id="play-gradient"
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
