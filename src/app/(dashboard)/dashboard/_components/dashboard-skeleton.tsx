/**
 * Inline Suspense fallback skeleton for dashboard data sections.
 * Used inside the page (not as loading.tsx) so the Topbar renders immediately.
 */
export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="h-4 w-20 shimmer rounded-lg bg-gray-100" />
                <div className="h-8 w-12 shimmer rounded-lg bg-gray-100" />
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 shimmer rounded-xl bg-gray-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions + Pending row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm"
          >
            <div className="mb-4 h-5 w-32 shimmer rounded-lg bg-gray-100" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 shimmer rounded-xl bg-gray-50" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Today's Shifts */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="mb-5 h-5 w-36 shimmer rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-gray-50/30 p-4"
            >
              <div className="h-10 w-10 shimmer rounded-xl bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 shimmer rounded-lg bg-gray-100" />
                <div className="h-3 w-1/2 shimmer rounded-lg bg-gray-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmployeeDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)]"
          >
            <div className="h-10 w-10 shimmer rounded-xl bg-gray-100" />
            <div className="h-4 w-20 shimmer rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Shifts Today */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
        <div className="mb-5 h-5 w-36 shimmer rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-gray-50/30 p-4"
            >
              <div className="h-10 w-10 shimmer rounded-xl bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 shimmer rounded-lg bg-gray-100" />
                <div className="h-3 w-1/2 shimmer rounded-lg bg-gray-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
