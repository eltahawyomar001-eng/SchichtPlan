export default function StempeluhrLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="h-8 w-40 shimmer rounded-xl bg-gray-100" />

      {/* Clock display skeleton */}
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm text-center">
          <div className="mx-auto h-16 w-40 shimmer rounded-xl bg-gray-100 mb-6" />
          <div className="mx-auto h-14 w-14 shimmer rounded-full bg-gray-100 mb-4" />
          <div className="mx-auto h-4 w-32 shimmer rounded-lg bg-gray-50" />
        </div>
      </div>

      {/* Recent entries skeleton */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="mb-4 h-5 w-36 shimmer rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-gray-50/30 p-4"
            >
              <div className="space-y-1">
                <div className="h-4 w-24 shimmer rounded-lg bg-gray-100" />
                <div className="h-3 w-32 shimmer rounded-lg bg-gray-50" />
              </div>
              <div className="h-6 w-16 shimmer rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
