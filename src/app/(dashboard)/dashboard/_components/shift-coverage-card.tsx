import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarIcon, AlertTriangleIcon } from "@/components/icons";
import Link from "next/link";

/* ── Types ── */
export interface CoverageDay {
  date: string; // ISO date
  label: string; // formatted e.g. "Mo 14.04."
  totalShifts: number;
  filledShifts: number;
  openShifts: number;
}

interface ShiftCoverageCardProps {
  days: CoverageDay[];
  title: string;
  coverageLabel: string;
  openShiftsLabel: string;
  fullCoverageLabel: string;
  viewPlanLabel: string;
  emptyLabel: string;
}

export function ShiftCoverageCard({
  days,
  title,
  coverageLabel,
  openShiftsLabel,
  fullCoverageLabel,
  viewPlanLabel,
  emptyLabel,
}: ShiftCoverageCardProps) {
  const totalOpen = days.reduce((s, d) => s + d.openShifts, 0);
  const totalShifts = days.reduce((s, d) => s + d.totalShifts, 0);
  const overallCoverage =
    totalShifts > 0
      ? Math.round(
          (days.reduce((s, d) => s + d.filledShifts, 0) / totalShifts) * 100,
        )
      : 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {totalOpen > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 px-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                {totalOpen}
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              overallCoverage >= 100
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                : overallCoverage >= 80
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
            )}
          >
            {overallCoverage}% {coverageLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {days.length === 0 || totalShifts === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 mb-3">
              <CalendarIcon className="h-6 w-6 text-emerald-400 dark:text-emerald-600" />
            </div>
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((day) => {
              const pct =
                day.totalShifts > 0
                  ? Math.round((day.filledShifts / day.totalShifts) * 100)
                  : 100;
              const hasGaps = day.openShifts > 0;
              return (
                <div
                  key={day.date}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                    hasGaps
                      ? "border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10"
                      : "border-gray-100 dark:border-zinc-700/50",
                  )}
                >
                  <div className="flex-shrink-0 w-16">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {day.label}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct >= 100
                            ? "bg-emerald-400"
                            : pct >= 80
                              ? "bg-amber-400"
                              : "bg-red-400",
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                      {day.filledShifts}/{day.totalShifts}
                    </span>
                    {hasGaps && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                        <AlertTriangleIcon className="h-3 w-3" />
                        {day.openShifts}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {totalOpen > 0 && (
              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  {totalOpen} {openShiftsLabel}
                </p>
                <Link
                  href="/schichtplan"
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {viewPlanLabel} →
                </Link>
              </div>
            )}
            {totalOpen === 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center pt-1">
                ✓ {fullCoverageLabel}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
