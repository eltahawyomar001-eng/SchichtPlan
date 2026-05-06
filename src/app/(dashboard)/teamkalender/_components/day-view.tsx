"use client";

import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import type { CalendarShift, CalendarAbsence, CalendarHoliday } from "./types";

interface DayViewProps {
  currentDate: Date;
  shifts: CalendarShift[];
  absences: CalendarAbsence[];
  publicHolidays: CalendarHoliday[];
  categoryLabel: (cat: string) => string;
}

const ABSENCE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  URLAUB: {
    bg: "bg-cyan-50",
    text: "text-cyan-800",
    border: "border-cyan-300",
  },
  KRANK: { bg: "bg-pink-50", text: "text-pink-800", border: "border-pink-300" },
  ELTERNZEIT: {
    bg: "bg-violet-50",
    text: "text-violet-800",
    border: "border-violet-300",
  },
  SONDERURLAUB: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-300",
  },
  UNBEZAHLT: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-300",
  },
  FORTBILDUNG: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  SONSTIGES: {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-300",
  },
};

export function DayView({
  currentDate,
  shifts,
  absences,
  publicHolidays,
  categoryLabel,
}: DayViewProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "en" ? enUS : de;

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const dayShifts = shifts.filter((s) => s.date === dateStr);
  const dayAbsences = absences.filter((a) => {
    const start = new Date(a.startDate);
    const end = new Date(a.endDate);
    return currentDate >= start && currentDate <= end;
  });
  const dayHoliday = publicHolidays.find((h) => h.date === dateStr);

  const hasEvents =
    dayShifts.length > 0 || dayAbsences.length > 0 || dayHoliday;

  return (
    <div className="space-y-4">
      {/* Day header */}
      <h3 className="text-base font-semibold text-gray-800 dark:text-zinc-200">
        {format(currentDate, "EEEE, d. MMMM yyyy", { locale: dateFnsLocale })}
      </h3>

      {!hasEvents && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 py-12 text-center text-sm text-gray-400 dark:text-zinc-500">
          Keine Einträge für diesen Tag
        </div>
      )}

      {/* Holiday banner */}
      {dayHoliday && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {dayHoliday.name}
          </span>
          <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-500">
            Feiertag
          </span>
        </div>
      )}

      {/* Shift list */}
      {dayShifts.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
            Schichten ({dayShifts.length})
          </h4>
          {dayShifts
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3"
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400 dark:bg-zinc-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">
                    {s.employee
                      ? `${s.employee.lastName}, ${s.employee.firstName}`
                      : "–"}
                  </p>
                  {s.employee?.departmentId && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                      {s.status}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">
                  {s.startTime} – {s.endTime}
                </span>
              </div>
            ))}
        </section>
      )}

      {/* Absence list */}
      {dayAbsences.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
            Abwesenheiten ({dayAbsences.length})
          </h4>
          {dayAbsences.map((a) => {
            const colors =
              ABSENCE_COLORS[a.category] ?? ABSENCE_COLORS.SONSTIGES;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${colors.bg} ${colors.border}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${colors.text}`}>
                    {a.employee.lastName}, {a.employee.firstName}
                  </p>
                  <p className={`text-xs truncate ${colors.text} opacity-70`}>
                    {categoryLabel(a.category)} · bis{" "}
                    {format(new Date(a.endDate), "d. MMM", {
                      locale: dateFnsLocale,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
