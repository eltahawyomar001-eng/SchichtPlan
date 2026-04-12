export default function TicketDetailLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-7 w-64 animate-pulse rounded-lg bg-gray-200" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description card */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-3">
            <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-4">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
