import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { BriefcaseIcon, BuildingIcon } from "@/components/icons";

/* ── Types ── */
export interface LiveProject {
  id: string; // timeEntry id for uniqueness
  projectName: string;
  projectIcon?: "building" | "briefcase";
  startTime: string; // "HH:MM"
  sinceLabel: string; // pre-formatted "seit 22:20"
  progressPercent: number; // 0-100
  employee: {
    name: string;
    color: string | null;
  };
}

interface LiveProjectsCardProps {
  projects: LiveProject[];
  title: string;
  emptyLabel: string;
}

const iconMap = {
  building: BuildingIcon,
  briefcase: BriefcaseIcon,
} as const;

export function LiveProjectsCard({
  projects,
  title,
  emptyLabel,
}: LiveProjectsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {projects.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 px-1.5 text-[11px] font-semibold text-gray-600 dark:text-zinc-400">
                {projects.length}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-700/50 p-3">
              <BriefcaseIcon className="h-6 w-6 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((proj) => {
              const Icon = iconMap[proj.projectIcon ?? "briefcase"];
              return (
                <div
                  key={proj.id}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Project icon with live dot */}
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/40">
                      <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    {/* Green live dot */}
                    <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                    </span>
                  </div>

                  {/* Title + since + progress bar */}
                  <div className="flex flex-col min-w-0 flex-1 gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                        {proj.projectName}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap tabular-nums">
                        {proj.sinceLabel}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(2, proj.progressPercent))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Employee avatar */}
                  <Avatar
                    name={proj.employee.name}
                    color={proj.employee.color ?? "#10b981"}
                    size="sm"
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
