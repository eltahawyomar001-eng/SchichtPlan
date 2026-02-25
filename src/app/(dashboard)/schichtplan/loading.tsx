export default function SchichtplanLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>

      {/* Shift grid rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                className="h-16 animate-pulse rounded-lg bg-gray-50 border border-gray-100"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
