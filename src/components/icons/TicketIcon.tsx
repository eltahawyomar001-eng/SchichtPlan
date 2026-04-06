import { type SVGProps } from "react";

/**
 * Ticket icon. Used for the ticketing / support system.
 * Gradient stroke from Brand/600 (#059669) to Brand/400 (#34d399).
 * Based on a standard ticket/coupon shape.
 */
export function TicketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z"
        stroke="url(#ticket-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 5v2"
        stroke="url(#ticket-dash-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 17v2"
        stroke="url(#ticket-dash-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 11v2"
        stroke="url(#ticket-dash-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="ticket-gradient"
          x1="2"
          y1="5"
          x2="22"
          y2="19"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient
          id="ticket-dash-gradient"
          x1="13"
          y1="5"
          x2="13"
          y2="19"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}
