export default function LeistungsnachweisLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Visit cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4"
          >
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded-full bg-gray-100" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
