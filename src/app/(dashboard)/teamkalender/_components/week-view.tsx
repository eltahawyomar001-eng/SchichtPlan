"use client";

import { useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import type { CalendarShift, CalendarAbsence, CalendarHoliday } from "./types";

const ABSENCE_BG: Record<string, string> = {
  URLAUB: "bg-cyan-100 text-cyan-800 border-cyan-300",
  KRANK: "bg-pink-100 text-pink-800 border-pink-300",
  ELTERNZEIT: "bg-violet-100 text-violet-800 border-violet-300",
  SONDERURLAUB: "bg-amber-100 text-amber-800 border-amber-300",
  UNBEZAHLT: "bg-gray-100 text-gray-700 border-gray-300",
  FORTBILDUNG: "bg-blue-100 text-blue-800 border-blue-300",
  SONSTIGES: "bg-gray-100 text-gray-600 border-gray-300",
};

interface WeekViewProps {
  currentDate: Date;
  shifts: CalendarShift[];
  absences: CalendarAbsence[];
  publicHolidays: CalendarHoliday[];
  categoryLabel: (cat: string) => string;
}

export function WeekView({
  currentDate,
  shifts,
  absences,
  publicHolidays,
  categoryLabel,
}: WeekViewProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "en" ? enUS : de;

  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, CalendarShift[]>();
    for (const s of shifts) {
      const existing = map.get(s.date) ?? [];
      existing.push(s);
      map.set(s.date, existing);
    }
    return map;
  }, [shifts]);

  const absencesByDay = useMemo(() => {
    const map = new Map<string, CalendarAbsence[]>();
    for (const a of absences) {
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      for (const day of days) {
        if (day >= start && day <= end) {
          const k = dateKey(day);
          const existing = map.get(k) ?? [];
          existing.push(a);
          map.set(k, existing);
        }
      }
    }
    return map;
  }, [absences, days]);

  const holidaysByDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of publicHolidays) {
      map.set(h.date, h.name);
    }
    return map;
  }, [publicHolidays]);

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-zinc-700 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
      {days.map((day) => {
        const k = dateKey(day);
        const dayShifts = shiftsByDay.get(k) ?? [];
        const dayAbsences = absencesByDay.get(k) ?? [];
        const holiday = holidaysByDay.get(k);
        const today = isToday(day);

        return (
          <div
            key={k}
            className={`bg-white dark:bg-zinc-900 p-2 min-h-[200px] flex flex-col gap-1 ${
              holiday ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""
            }`}
          >
            {/* Day header */}
            <div className="flex flex-col items-center mb-1">
              <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wide">
                {format(day, "EEE", { locale: dateFnsLocale })}
              </span>
              <span
                className={`text-sm font-semibold ${
                  today
                    ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white"
                    : "text-gray-800 dark:text-zinc-200"
                }`}
              >
                {format(day, "d")}
              </span>
            </div>

            {/* Holiday chip */}
            {holiday && (
              <span className="truncate rounded-full bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                {holiday}
              </span>
            )}

            {/* Absence chips */}
            {dayAbsences.map((a) => (
              <span
                key={a.id}
                className={`truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                  ABSENCE_BG[a.category] ?? ABSENCE_BG.SONSTIGES
                }`}
                title={`${a.employee.lastName}, ${a.employee.firstName} (${categoryLabel(a.category)})`}
              >
                {a.employee.lastName}, {a.employee.firstName[0]}.
              </span>
            ))}

            {/* Shift chips */}
            {dayShifts.map((s) => (
              <span
                key={s.id}
                className="truncate rounded-full bg-gray-200 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 px-1.5 py-0.5 text-[10px] font-medium text-gray-800 dark:text-zinc-200"
                title={`${s.employee?.lastName ?? ""}, ${s.employee?.firstName ?? ""} ${s.startTime}–${s.endTime}`}
              >
                {s.employee?.lastName ?? "–"},{" "}
                {s.employee?.firstName?.[0] ?? ""}. {s.startTime}
              </span>
            ))}

            {dayShifts.length === 0 && dayAbsences.length === 0 && !holiday && (
              <span className="text-[10px] text-gray-300 dark:text-zinc-600 text-center mt-auto mb-auto">
                —
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
