import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  CalendarOffIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "@/components/icons";

/* ── Types ── */
export interface AbsentEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  category: string; // AbsenceCategory enum value
  daysRemaining: number;
}

interface AbsenteeismCardProps {
  employees: AbsentEmployee[];
  title: string;
  todayLabel: string;
  todayDate: string;
  daysRemainingLabel: (count: number) => string;
  categoryLabel: (cat: string) => string;
  emptyLabel: string;
  viewAllLabel: string;
  viewAllHref: string;
}

/* ── Category icon + color ── */
const categoryStyle: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  KRANK: {
    bg: "bg-red-50",
    text: "text-red-700",
    darkBg: "dark:bg-red-950/30",
    darkText: "dark:text-red-300",
  },
  URLAUB: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    darkBg: "dark:bg-blue-950/30",
    darkText: "dark:text-blue-300",
  },
  ELTERNZEIT: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    darkBg: "dark:bg-purple-950/30",
    darkText: "dark:text-purple-300",
  },
  SONDERURLAUB: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-950/30",
    darkText: "dark:text-amber-300",
  },
  UNBEZAHLT: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    darkBg: "dark:bg-zinc-800",
    darkText: "dark:text-zinc-300",
  },
  FORTBILDUNG: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    darkBg: "dark:bg-emerald-950/30",
    darkText: "dark:text-emerald-300",
  },
  SONSTIGES: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    darkBg: "dark:bg-zinc-800",
    darkText: "dark:text-zinc-300",
  },
};

export function AbsenteeismCard({
  employees,
  title,
  todayLabel,
  todayDate,
  daysRemainingLabel,
  categoryLabel,
  emptyLabel,
  viewAllLabel,
  viewAllHref,
}: AbsenteeismCardProps) {
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
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
            <span>{todayDate}</span>
            <span className="font-medium text-gray-600 dark:text-zinc-300">
              {todayLabel}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 p-3">
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {employees.map((emp) => {
              const style =
                categoryStyle[emp.category] ?? categoryStyle.SONSTIGES;
              return (
                <div
                  key={emp.id}
                  className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={`${emp.firstName} ${emp.lastName}`}
                      color={emp.color || undefined}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {daysRemainingLabel(emp.daysRemaining)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text} ${style.darkBg} ${style.darkText}`}
                  >
                    {emp.category === "KRANK" ? (
                      <AlertTriangleIcon className="h-3 w-3" />
                    ) : (
                      <CalendarOffIcon className="h-3 w-3" />
                    )}
                    {categoryLabel(emp.category)}
                  </span>
                </div>
              );
            })}
            {employees.length > 4 && (
              <a
                href={viewAllHref}
                className="block text-center text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 pt-2 transition-colors"
              >
                {viewAllLabel} →
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
