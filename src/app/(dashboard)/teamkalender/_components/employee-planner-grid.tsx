"use client";

import { useMemo } from "react";
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import type {
  CalendarEmployee,
  CalendarShift,
  CalendarAbsence,
  CalendarHoliday,
} from "./types";

type PeriodTab = "year" | "month" | "week" | "day";

interface EmployeePlannerGridProps {
  currentDate: Date;
  activePeriod: PeriodTab;
  employees: CalendarEmployee[];
  shifts: CalendarShift[];
  absences: CalendarAbsence[];
  publicHolidays: CalendarHoliday[];
  categoryLabel: (cat: string) => string;
}

const ABSENCE_DOT: Record<string, string> = {
  URLAUB: "bg-cyan-400",
  KRANK: "bg-pink-400",
  ELTERNZEIT: "bg-violet-400",
  SONDERURLAUB: "bg-amber-400",
  UNBEZAHLT: "bg-gray-400",
  FORTBILDUNG: "bg-blue-400",
  SONSTIGES: "bg-gray-300",
};

export function EmployeePlannerGrid({
  currentDate,
  activePeriod,
  employees,
  shifts,
  absences,
  publicHolidays,
  categoryLabel,
}: EmployeePlannerGridProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "en" ? enUS : de;

  // Build the day columns based on period
  const days = useMemo(() => {
    if (activePeriod === "week") {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      });
    }
    if (activePeriod === "day") {
      return [currentDate];
    }
    // month (default — also used for "year" at month granularity)
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
  }, [currentDate, activePeriod]);

  const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

  // shift map: empId → Set<dateKey>
  const shiftMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of shifts) {
      if (!s.employee) continue;
      if (!map.has(s.employee.id)) map.set(s.employee.id, new Set());
      map.get(s.employee.id)!.add(s.date);
    }
    return map;
  }, [shifts]);

  // absence map: empId → Map<dateKey, category>
  const absenceMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const a of absences) {
      const empId = a.employee.id;
      if (!map.has(empId)) map.set(empId, new Map());
      const empMap = map.get(empId)!;
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      for (const day of days) {
        if (day >= start && day <= end) {
          empMap.set(dateKey(day), a.category);
        }
      }
    }
    return map;
  }, [absences, days]);

  const holidayDates = useMemo(
    () => new Set(publicHolidays.map((h) => h.date)),
    [publicHolidays],
  );

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 py-12 text-center text-sm text-gray-400 dark:text-zinc-500">
        Keine Mitarbeiter für diesen Zeitraum
      </div>
    );
  }

  const isMonthView = activePeriod === "month" || activePeriod === "year";
  const compact = isMonthView; // smaller cells for 28-31 day columns

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {/* Employee name column */}
            <th className="sticky left-0 z-10 bg-white dark:bg-zinc-900 text-left px-3 py-2 font-semibold text-gray-700 dark:text-zinc-300 border-b border-gray-200 dark:border-zinc-700 min-w-[140px]">
              Mitarbeiter
            </th>
            {days.map((day) => {
              const isHoliday = holidayDates.has(dateKey(day));
              const today = isToday(day);
              const inCurrentMonth = isSameMonth(day, currentDate);

              return (
                <th
                  key={dateKey(day)}
                  className={`text-center font-medium border-b border-gray-200 dark:border-zinc-700 ${
                    compact
                      ? "px-0.5 py-1 min-w-[28px]"
                      : "px-2 py-2 min-w-[90px]"
                  } ${isHoliday ? "bg-emerald-50 dark:bg-emerald-900/20" : ""} ${
                    !inCurrentMonth && isMonthView ? "opacity-40" : ""
                  }`}
                >
                  {compact ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-gray-400 dark:text-zinc-500">
                        {format(day, "EEE", { locale: dateFnsLocale }).slice(
                          0,
                          1,
                        )}
                      </span>
                      <span
                        className={`font-semibold text-[10px] leading-none ${
                          today
                            ? "inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white"
                            : "text-gray-700 dark:text-zinc-300"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide">
                        {format(day, "EEE", { locale: dateFnsLocale })}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          today
                            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"
                            : "text-gray-800 dark:text-zinc-200"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, rowIdx) => {
            const empShifts = shiftMap.get(emp.id) ?? new Set();
            const empAbsences = absenceMap.get(emp.id) ?? new Map();

            return (
              <tr
                key={emp.id}
                className={
                  rowIdx % 2 === 0
                    ? "bg-white dark:bg-zinc-900"
                    : "bg-gray-50/60 dark:bg-zinc-800/40"
                }
              >
                {/* Employee name */}
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium text-gray-800 dark:text-zinc-200 border-b border-gray-100 dark:border-zinc-800 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: emp.color ?? "#9ca3af" }}
                    />
                    {emp.lastName}, {emp.firstName}
                  </div>
                </td>

                {/* Day cells */}
                {days.map((day) => {
                  const k = dateKey(day);
                  const hasShift = empShifts.has(k);
                  const absCategory = empAbsences.get(k);
                  const isHoliday = holidayDates.has(k);

                  return (
                    <td
                      key={k}
                      className={`border-b border-gray-100 dark:border-zinc-800 text-center ${
                        compact ? "px-0 py-1" : "px-2 py-2"
                      } ${isHoliday ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}
                    >
                      {absCategory ? (
                        <span
                          className={`inline-block rounded-full ${
                            compact ? "h-2.5 w-2.5" : "h-3 w-3"
                          } ${ABSENCE_DOT[absCategory] ?? ABSENCE_DOT.SONSTIGES}`}
                          title={categoryLabel(absCategory)}
                        />
                      ) : hasShift ? (
                        <span
                          className={`inline-block rounded-full bg-emerald-500 ${
                            compact ? "h-2.5 w-2.5" : "h-3 w-3"
                          }`}
                          title="Schicht"
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-500 dark:text-zinc-400 pt-2 border-t border-gray-100 dark:border-zinc-800">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Schicht
        </span>
        {Object.entries(ABSENCE_DOT).map(([cat, colorClass]) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
            {categoryLabel(cat)}
          </span>
        ))}
      </div>
    </div>
  );
}
