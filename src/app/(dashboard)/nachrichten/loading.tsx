export default function NachrichtenLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="h-8 w-44 shimmer rounded-xl bg-gray-100" />

      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Channel list skeleton */}
        <div className="w-72 rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="h-8 w-8 shimmer rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-24 shimmer rounded-lg bg-gray-100" />
                  <div className="h-3 w-16 shimmer rounded-lg bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area skeleton */}
        <div className="flex-1 rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
          <div className="flex flex-col h-full">
            <div className="h-6 w-32 shimmer rounded-lg bg-gray-100 mb-4" />
            <div className="flex-1 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${i % 2 ? "justify-end" : ""}`}
                >
                  {!(i % 2) && (
                    <div className="h-8 w-8 shimmer rounded-full bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="h-12 w-48 shimmer rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
            <div className="h-12 w-full shimmer rounded-xl bg-gray-50 mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
