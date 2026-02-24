import { type SVGProps } from "react";

/** Truck icon for logistics industry */
export function TruckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="5.5"
        cy="18.5"
        r="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="18.5"
        cy="18.5"
        r="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
