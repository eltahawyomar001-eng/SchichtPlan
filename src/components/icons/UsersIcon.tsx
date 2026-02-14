import { type SVGProps } from "react";

/**
 * Users/team icon with gradient stroke. Used for employee management sections.
 * Animation-ready with separate path elements for each figure.
 */
export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="url(#users-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="7"
        r="4"
        stroke="url(#users-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="url(#users-secondary-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="users-gradient"
          x1="1"
          y1="3"
          x2="17"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient
          id="users-secondary-gradient"
          x1="13"
          y1="3"
          x2="23"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#C4B5FD" />
        </linearGradient>
      </defs>
    </svg>
  );
}
