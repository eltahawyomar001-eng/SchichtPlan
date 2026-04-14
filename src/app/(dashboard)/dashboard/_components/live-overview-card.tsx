"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { UsersIcon } from "@/components/icons";

/* ── Types ── */
export type LiveStatus = "working" | "break" | "clocked_out";

export interface LiveEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  status: LiveStatus;
  since?: string; // e.g. "08:30"
  duration?: string; // e.g. "3h 12m"
  location?: string;
}

interface LiveOverviewCardProps {
  employees: LiveEmployee[];
  title: string;
  workingLabel: string;
  breakLabel: string;
  clockedOutLabel: string;
  sinceLabel: string;
  emptyLabel: string;
}

const statusConfig: Record<
  LiveStatus,
  {
    dot: string;
    bg: string;
    text: string;
    darkBg: string;
    darkText: string;
    pulse: boolean;
  }
> = {
  working: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    darkBg: "dark:bg-emerald-950/30",
    darkText: "dark:text-emerald-300",
    pulse: true,
  },
  break: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-950/30",
    darkText: "dark:text-amber-300",
    pulse: true,
  },
  clocked_out: {
    dot: "bg-gray-400",
    bg: "bg-gray-50",
    text: "text-gray-600",
    darkBg: "dark:bg-zinc-800",
    darkText: "dark:text-zinc-400",
    pulse: false,
  },
};

export function LiveOverviewCard({
  employees,
  title,
  workingLabel,
  breakLabel,
  clockedOutLabel,
  sinceLabel,
  emptyLabel,
}: LiveOverviewCardProps) {
  const working = employees.filter((e) => e.status === "working");
  const onBreak = employees.filter((e) => e.status === "break");
  const clockedOut = employees.filter((e) => e.status === "clocked_out");

  const statusLabelMap: Record<LiveStatus, string> = {
    working: workingLabel,
    break: breakLabel,
    clocked_out: clockedOutLabel,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {employees.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 px-1.5 text-[11px] font-semibold text-gray-600 dark:text-zinc-400">
                {employees.length}
              </span>
            )}
          </div>
          {/* Summary pills */}
          <div className="flex items-center gap-2">
            {[
              { count: working.length, status: "working" as LiveStatus },
              { count: onBreak.length, status: "break" as LiveStatus },
              { count: clockedOut.length, status: "clocked_out" as LiveStatus },
            ]
              .filter((g) => g.count > 0)
              .map((g) => {
                const cfg = statusConfig[g.status];
                return (
                  <div
                    key={g.status}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                      cfg.bg,
                      cfg.darkBg,
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        cfg.dot,
                        cfg.pulse && "animate-pulse",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        cfg.text,
                        cfg.darkText,
                      )}
                    >
                      {g.count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-3 mb-3">
              <UsersIcon className="h-6 w-6 text-gray-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {employees.map((emp) => {
              const cfg = statusConfig[emp.status];
              return (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-zinc-700/50 p-3 transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-800/50"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar
                      name={`${emp.firstName} ${emp.lastName}`}
                      color={emp.color ?? undefined}
                      size="sm"
                    />
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900",
                        cfg.dot,
                        cfg.pulse && "animate-pulse",
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          cfg.text,
                          cfg.darkText,
                        )}
                      >
                        {statusLabelMap[emp.status]}
                      </span>
                      {emp.location && (
                        <>
                          <span className="text-gray-300 dark:text-zinc-600">
                            ·
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">
                            {emp.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {emp.since && (
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                        {sinceLabel} {emp.since}
                      </p>
                    )}
                    {emp.duration && (
                      <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                        {emp.duration}
                      </p>
                    )}
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
