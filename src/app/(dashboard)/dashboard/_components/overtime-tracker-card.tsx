import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ClockIcon } from "@/components/icons";

/* ── Types ── */
export interface OvertimeEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  overtimeMinutes: number; // positive = overtime, negative = undertime
  contractHours: number;
}

interface OvertimeTrackerCardProps {
  employees: OvertimeEmployee[];
  title: string;
  totalLabel: string;
  hoursLabel: string;
  emptyLabel: string;
  emptyDesc: string;
  overtimeLabel: string;
  undertimeLabel: string;
}

export function OvertimeTrackerCard({
  employees,
  title,
  totalLabel,
  hoursLabel,
  emptyLabel,
  emptyDesc,
  overtimeLabel,
  undertimeLabel,
}: OvertimeTrackerCardProps) {
  const totalOvertime = employees.reduce(
    (sum, e) => sum + e.overtimeMinutes,
    0,
  );
  const totalHours = Math.round(totalOvertime / 60);
  const sorted = [...employees].sort(
    (a, b) => Math.abs(b.overtimeMinutes) - Math.abs(a.overtimeMinutes),
  );
  const top = sorted.slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              totalOvertime > 0
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                : totalOvertime < 0
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                  : "bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
            )}
          >
            {totalOvertime > 0 ? "+" : ""}
            {totalHours} {hoursLabel}
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {totalLabel}
        </p>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-3 mb-3">
              <ClockIcon className="h-6 w-6 text-gray-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-zinc-500">
              {emptyLabel}
            </p>
            <p className="text-xs text-gray-300 dark:text-zinc-600 mt-1">
              {emptyDesc}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {top.map((emp) => {
              const hours = Math.round(emp.overtimeMinutes / 60);
              const isOvertime = emp.overtimeMinutes > 0;
              const maxAbs = Math.max(
                ...top.map((e) => Math.abs(e.overtimeMinutes)),
                1,
              );
              const barWidth = Math.round(
                (Math.abs(emp.overtimeMinutes) / maxAbs) * 100,
              );
              return (
                <div key={emp.id} className="group">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={`${emp.firstName} ${emp.lastName}`}
                      color={emp.color ?? undefined}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-semibold ml-2",
                            isOvertime
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-blue-600 dark:text-blue-400",
                          )}
                        >
                          {isOvertime ? "+" : ""}
                          {hours}h
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isOvertime
                              ? "bg-gradient-to-r from-amber-400 to-amber-500"
                              : "bg-gradient-to-r from-blue-400 to-blue-500",
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                        {isOvertime ? overtimeLabel : undertimeLabel}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
