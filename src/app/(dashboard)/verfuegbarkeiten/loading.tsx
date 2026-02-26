export default function VerfuegbarkeitenLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 shimmer rounded-xl bg-gray-100" />
        <div className="h-10 w-32 shimmer rounded-xl bg-gray-100" />
      </div>

      {/* Weekly grid skeleton */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-12 shimmer rounded-lg bg-gray-100 mx-auto" />
              <div className="h-24 w-full shimmer rounded-xl bg-gray-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
