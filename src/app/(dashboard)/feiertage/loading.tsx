export default function FeiertageLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-28 shimmer rounded-xl bg-gray-100" />
      </div>

      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-gray-50/30 p-4"
            >
              <div className="space-y-1">
                <div className="h-4 w-40 shimmer rounded-lg bg-gray-100" />
                <div className="h-3 w-24 shimmer rounded-lg bg-gray-50" />
              </div>
              <div className="h-6 w-16 shimmer rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
