import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

/* ── Types ── */
export interface LocationGroup {
  id: string;
  name: string;
  color: string; // Tailwind bg color for the dot + bar segment
  barColor: string; // Tailwind bg color for the distribution bar segment
  employees: {
    id: string;
    firstName: string;
    lastName: string;
    color: string | null;
  }[];
}

interface LocationDistributionCardProps {
  locations: LocationGroup[];
  title: string;
  total: number;
  emptyLabel: string;
}

export function LocationDistributionCard({
  locations,
  title,
  total,
  emptyLabel,
}: LocationDistributionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {total > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 px-1.5 text-[11px] font-semibold text-gray-600 dark:text-zinc-400">
              {total}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* ── Distribution bar ── */}
        {total > 0 && (
          <div className="flex h-3 w-full overflow-hidden rounded-full mb-5 gap-0.5">
            {locations.map((loc) => {
              const pct = (loc.employees.length / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={loc.id}
                  className={`${loc.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%`, minWidth: pct > 0 ? "8px" : 0 }}
                />
              );
            })}
          </div>
        )}

        {/* ── Location list ── */}
        <div className="space-y-1">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`h-3 w-3 rounded-full ${loc.color} flex-shrink-0`}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {loc.name}
                </span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 px-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                  {loc.employees.length}
                </span>
              </div>
              <div className="flex items-center -space-x-2">
                {loc.employees.slice(0, 3).map((emp) => (
                  <Avatar
                    key={emp.id}
                    name={`${emp.firstName} ${emp.lastName}`}
                    color={emp.color || undefined}
                    size="sm"
                    className="ring-2 ring-white dark:ring-zinc-900"
                  />
                ))}
                {loc.employees.length > 3 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-[10px] font-semibold text-gray-500 dark:text-zinc-400 ring-2 ring-white dark:ring-zinc-900">
                    +{loc.employees.length - 3}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {total === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
