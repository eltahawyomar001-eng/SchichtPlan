export default function StandorteLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-36 shimmer rounded-xl bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm"
          >
            <div className="mb-3 h-5 w-32 shimmer rounded-lg bg-gray-100" />
            <div className="h-4 w-full shimmer rounded-lg bg-gray-50 mb-2" />
            <div className="h-4 w-2/3 shimmer rounded-lg bg-gray-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
