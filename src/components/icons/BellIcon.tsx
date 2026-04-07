import { type SVGProps } from "react";
import { useId } from "react";

/**
 * Bell/notification icon with gradient stroke.
 * Uses useId() to avoid duplicate gradient IDs when rendered multiple times.
 */
export function BellIcon(props: SVGProps<SVGSVGElement>) {
  const id = useId();
  const gradientId = `bell-gradient-${id}`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9z"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />{" "}
    </svg>
  );
}
