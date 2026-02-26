export default function AbwesenheitenLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-56 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-40 shimmer rounded-xl bg-gray-100" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-28 shimmer rounded-xl bg-gray-100" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-gray-50/30 p-4"
            >
              <div className="h-10 w-10 shimmer rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 shimmer rounded-lg bg-gray-100" />
                <div className="h-3 w-1/3 shimmer rounded-lg bg-gray-50" />
              </div>
              <div className="h-6 w-20 shimmer rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
