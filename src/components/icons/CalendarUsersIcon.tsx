export function CalendarUsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <rect x="2" y="4" width="20" height="18" rx="2" />
      <path d="M2 10h20" />
      <circle cx="9" cy="16" r="2" />
      <circle cx="15" cy="16" r="2" />
    </svg>
  );
}
