import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { AwardIcon } from "@/components/icons";

/* ── Types ── */
export interface CelebrationEntry {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  type: "birthday" | "anniversary";
  date: string; // formatted display date
  detail?: string; // e.g. "3 Jahre" or age
  daysUntil: number; // 0 = today
}

interface CelebrationsCardProps {
  entries: CelebrationEntry[];
  title: string;
  birthdayLabel: string;
  anniversaryLabel: string;
  todayLabel: string;
  tomorrowLabel: string;
  inDaysLabel: (days: number) => string;
  emptyLabel: string;
  emptyDesc: string;
}

export function CelebrationsCard({
  entries,
  title,
  birthdayLabel,
  anniversaryLabel,
  todayLabel,
  tomorrowLabel,
  inDaysLabel,
  emptyLabel,
  emptyDesc,
}: CelebrationsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {entries.length > 0 && <span className="text-lg">🎉</span>}
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 p-3 mb-3">
              <AwardIcon className="h-6 w-6 text-purple-300 dark:text-purple-700" />
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
            {entries.map((entry) => {
              const daysLabel =
                entry.daysUntil === 0
                  ? todayLabel
                  : entry.daysUntil === 1
                    ? tomorrowLabel
                    : inDaysLabel(entry.daysUntil);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-zinc-700/50 p-3"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar
                      name={`${entry.firstName} ${entry.lastName}`}
                      color={entry.color ?? undefined}
                      size="sm"
                    />
                    <span className="absolute -top-1 -right-1 text-sm">
                      {entry.type === "birthday" ? "🎂" : "🏆"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                      {entry.firstName} {entry.lastName}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {entry.type === "birthday"
                        ? birthdayLabel
                        : anniversaryLabel}
                      {entry.detail && ` · ${entry.detail}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                        entry.daysUntil === 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {daysLabel}
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
