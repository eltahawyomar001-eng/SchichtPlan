export default function EinstellungenLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="h-8 w-44 shimmer rounded-xl bg-gray-100" />

      {/* Tab bar skeleton */}
      <div className="flex gap-2 border-b border-gray-100 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 shimmer rounded-lg bg-gray-100" />
        ))}
      </div>

      {/* Settings form skeleton */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 shimmer rounded-lg bg-gray-100" />
              <div className="h-10 w-full shimmer rounded-xl bg-gray-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
