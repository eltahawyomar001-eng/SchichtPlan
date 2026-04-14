import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClockIcon,
  PauseIcon,
  PlayIcon,
  BriefcaseIcon,
} from "@/components/icons";

/* ── Types ── */
export type ActivityType =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "project";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  time: string; // "HH:MM"
  employeeName: string; // "Nachname, Vorname"
  label: string; // translated label e.g. "Arbeitszeit" or project name
}

interface RecentActivityCardProps {
  events: ActivityEvent[];
  title: string;
  emptyLabel: string;
  timeUnit?: string; // e.g. "Uhr" or "h" — defaults to "Uhr" for backward compat
}

/* ── Icon + color per activity type ── */
const activityStyle: Record<
  ActivityType,
  {
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    bg: string;
    text: string;
  }
> = {
  clock_in: {
    Icon: PlayIcon,
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  clock_out: {
    Icon: ClockIcon,
    bg: "bg-gray-100 dark:bg-zinc-800",
    text: "text-gray-500 dark:text-zinc-400",
  },
  break_start: {
    Icon: PauseIcon,
    bg: "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
  },
  break_end: {
    Icon: PlayIcon,
    bg: "bg-blue-100 dark:bg-blue-950/40",
    text: "text-blue-600 dark:text-blue-400",
  },
  project: {
    Icon: BriefcaseIcon,
    bg: "bg-purple-100 dark:bg-purple-950/40",
    text: "text-purple-600 dark:text-purple-400",
  },
};

export function RecentActivityCard({
  events,
  title,
  emptyLabel,
  timeUnit = "Uhr",
}: RecentActivityCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {events.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 px-1.5 text-[11px] font-semibold text-gray-600 dark:text-zinc-400">
                {events.length}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-700/50 p-3">
              <ClockIcon className="h-6 w-6 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {events.map((event) => {
              const style = activityStyle[event.type];
              const { Icon } = style;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${style.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-semibold text-gray-900 dark:text-zinc-100 tabular-nums">
                        {event.time} {timeUnit}
                      </span>
                      <span className="text-gray-300 dark:text-zinc-600">
                        |
                      </span>
                      <span className="truncate text-gray-700 dark:text-zinc-300">
                        {event.employeeName}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                      {event.label}
                    </span>
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
