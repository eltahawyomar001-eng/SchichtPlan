import { type SVGProps } from "react";

/** Team calendar icon with gradient */
export function CalendarUsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M16 2v4M8 2v4"
        stroke="url(#caluser-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="2"
        y="4"
        width="20"
        height="18"
        rx="2"
        stroke="url(#caluser-gradient)"
        strokeWidth="2"
      />
      <path
        d="M2 10h20"
        stroke="url(#caluser-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="9"
        cy="16"
        r="2"
        stroke="url(#caluser-gradient)"
        strokeWidth="1.5"
      />
      <circle
        cx="15"
        cy="16"
        r="2"
        stroke="url(#caluser-gradient)"
        strokeWidth="1.5"
      />
      <defs>
        <linearGradient
          id="caluser-gradient"
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
