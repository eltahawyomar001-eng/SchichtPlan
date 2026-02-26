export default function LohnexportLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-36 shimmer rounded-xl bg-gray-100" />
      </div>

      {/* Month selector skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-32 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-32 shimmer rounded-xl bg-gray-100" />
      </div>

      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-gray-50/30 p-4"
            >
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 shimmer rounded-lg bg-gray-100" />
                <div className="h-3 w-1/3 shimmer rounded-lg bg-gray-50" />
              </div>
              <div className="h-8 w-24 shimmer rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
