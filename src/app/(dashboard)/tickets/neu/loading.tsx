export default function NewTicketLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Form card */}
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-100 bg-white p-6 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
          </div>
        ))}
        {/* Description textarea */}
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-28 w-full animate-pulse rounded-lg bg-gray-100" />
        </div>
        {/* Submit button */}
        <div className="flex justify-end">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
