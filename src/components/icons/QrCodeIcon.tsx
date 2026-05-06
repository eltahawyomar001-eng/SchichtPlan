import { type SVGProps } from "react";

export function QrCodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="5" y="5" width="3" height="3" fill="currentColor" />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="16" y="5" width="3" height="3" fill="currentColor" />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="5" y="16" width="3" height="3" fill="currentColor" />
      <path d="M14 14h2v2h-2z" fill="currentColor" />
      <path d="M18 14h3v2h-3z" fill="currentColor" />
      <path d="M14 18h2v3h-2z" fill="currentColor" />
      <path d="M18 18h3v3h-3z" fill="currentColor" />
    </svg>
  );
}
