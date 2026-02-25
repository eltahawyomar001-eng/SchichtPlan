export default function ZeiterfassungLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-100" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 border-b border-gray-100 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-4 border-b border-gray-50 p-4"
          >
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
