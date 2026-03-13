/**
 * Page Skeleton — Reusable loading skeleton components.
 *
 * Provides generic and page-specific skeleton layouts that match
 * the real page structures for seamless loading transitions.
 * Uses the existing `.shimmer` animation from globals.css.
 *
 * @example
 * ```tsx
 * import { DashboardSkeleton } from "@/components/ui/page-skeleton";
 * export default function Loading() { return <DashboardSkeleton />; }
 * ```
 */

import { cn } from "@/lib/utils";

/** A single shimmer block with configurable dimensions */
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={cn("shimmer rounded-lg", className)} aria-hidden="true" />
  );
}

/** Generic content skeleton with configurable rows */
function ContentRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <ShimmerBlock
          key={i}
          className={cn(
            "h-14 rounded-xl",
            i === 0 && "w-full",
            i === 1 && "w-[92%]",
            i === 2 && "w-[88%]",
            i === 3 && "w-[95%]",
            i >= 4 && "w-[85%]",
          )}
        />
      ))}
    </div>
  );
}

/** Header skeleton — iOS large title style */
function HeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <ShimmerBlock className="h-8 w-48" />
      <ShimmerBlock className="h-4 w-72" />
    </div>
  );
}

/** Stat card skeleton — used on dashboard */
function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <ShimmerBlock className="h-4 w-24" />
      <ShimmerBlock className="h-8 w-16" />
      <ShimmerBlock className="h-3 w-32" />
    </div>
  );
}

/* ── Page-Specific Skeletons ── */

/** Dashboard page skeleton */
export function DashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-150 p-4 lg:p-6 space-y-6">
      <HeaderSkeleton />
      {/* Stat cards grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      {/* Chart area */}
      <ShimmerBlock className="h-48 rounded-2xl" />
      {/* Recent activity */}
      <ContentRows count={4} />
    </div>
  );
}

/** Shift plan page skeleton — weekly calendar grid */
export function ShiftPlanSkeleton() {
  return (
    <div className="animate-in fade-in duration-150 p-4 lg:p-6 space-y-4">
      <HeaderSkeleton />
      {/* Week selector */}
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-10 w-10 rounded-lg" />
        <ShimmerBlock className="h-10 flex-1 rounded-lg" />
        <ShimmerBlock className="h-10 w-10 rounded-lg" />
      </div>
      {/* Day columns */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock className="h-8 rounded-lg" />
            <ShimmerBlock className="h-20 rounded-xl" />
            <ShimmerBlock className="h-20 rounded-xl" />
            <ShimmerBlock className="h-16 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Time entries page skeleton */
export function TimeEntriesSkeleton() {
  return (
    <div className="animate-in fade-in duration-150 p-4 lg:p-6 space-y-4">
      <HeaderSkeleton />
      {/* Filter bar */}
      <div className="flex gap-2">
        <ShimmerBlock className="h-10 w-32 rounded-lg" />
        <ShimmerBlock className="h-10 w-32 rounded-lg" />
        <ShimmerBlock className="h-10 flex-1 rounded-lg" />
      </div>
      {/* Time entry rows */}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4"
        >
          <ShimmerBlock className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-40" />
            <ShimmerBlock className="h-3 w-24" />
          </div>
          <ShimmerBlock className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Employee list page skeleton */
export function EmployeeListSkeleton() {
  return (
    <div className="animate-in fade-in duration-150 p-4 lg:p-6 space-y-4">
      <HeaderSkeleton />
      {/* Search bar */}
      <ShimmerBlock className="h-10 w-full rounded-lg" />
      {/* Employee cards */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4"
        >
          <ShimmerBlock className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-36" />
            <ShimmerBlock className="h-3 w-48" />
          </div>
          <ShimmerBlock className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Generic page skeleton — fallback for any page */
export function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-150 p-4 lg:p-6 space-y-6">
      <HeaderSkeleton />
      <ContentRows count={6} />
    </div>
  );
}
