export default function MonatsabschlussLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-52 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-32 shimmer rounded-xl bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm"
          >
            <div className="h-4 w-24 shimmer rounded-lg bg-gray-100 mb-3" />
            <div className="h-8 w-16 shimmer rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-gray-50/30 p-4"
            >
              <div className="h-4 w-40 shimmer rounded-lg bg-gray-100" />
              <div className="h-6 w-20 shimmer rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
