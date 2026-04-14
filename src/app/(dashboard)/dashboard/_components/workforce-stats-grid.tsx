import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";

/* ── Types ── */
export interface WorkforceStat {
  id: string;
  label: string;
  value: string; // formatted display value e.g. "0 Tage", "-18 Std", "4"
  numericValue: number; // raw number for coloring
  trend?: number | null; // +/- change vs previous period, null = no trend
  unit?: string; // appended after trend number
}

interface WorkforceStatsGridProps {
  stats: WorkforceStat[];
}

export function WorkforceStatsGrid({ stats }: WorkforceStatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {stats.map((stat) => {
        const isNegative = stat.numericValue < 0;
        return (
          <Card key={stat.id}>
            <CardContent className="relative p-5">
              {/* Trend badge — top-right */}
              {stat.trend != null && stat.trend !== 0 && (
                <div className="absolute right-4 top-4">
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      stat.trend > 0
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400"
                    }`}
                  >
                    {stat.trend > 0 ? (
                      <ArrowUpIcon className="h-3 w-3" />
                    ) : (
                      <ArrowDownIcon className="h-3 w-3" />
                    )}
                    {Math.abs(stat.trend)}
                  </span>
                </div>
              )}

              {/* Large value */}
              <p
                className={`text-2xl font-bold tracking-tight ${
                  isNegative
                    ? "text-red-500 dark:text-red-400"
                    : "text-cyan-500 dark:text-cyan-400"
                }`}
              >
                {stat.value}
              </p>

              {/* Label */}
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
