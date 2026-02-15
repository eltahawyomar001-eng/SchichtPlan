import { type SVGProps } from "react";

/**
 * User-plus icon with gradient stroke. Used for team invitation actions.
 */
export function UserPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="url(#user-plus-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="8.5"
        cy="7"
        r="4"
        stroke="url(#user-plus-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="8"
        x2="20"
        y2="14"
        stroke="url(#user-plus-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="23"
        y1="11"
        x2="17"
        y2="11"
        stroke="url(#user-plus-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="user-plus-gradient"
          x1="1"
          y1="3"
          x2="16"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient
          id="user-plus-secondary"
          x1="17"
          y1="8"
          x2="23"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#C4B5FD" />
        </linearGradient>
      </defs>
    </svg>
  );
}
