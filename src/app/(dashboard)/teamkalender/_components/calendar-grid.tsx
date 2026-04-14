"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  eachDayOfInterval,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isToday,
  differenceInCalendarDays,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { getCalendarWeek } from "@/lib/time-utils";
import type {
  CalendarShift,
  CalendarAbsence,
  CalendarHoliday,
  CalendarEmployee,
} from "./types";

/* ─── colour palette ──────────────────────────────────────────── */
const ABSENCE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  URLAUB: {
    bg: "bg-cyan-100 dark:bg-cyan-900/40",
    text: "text-cyan-800 dark:text-cyan-300",
    border: "border-cyan-300 dark:border-cyan-700",
  },
  KRANK: {
    bg: "bg-pink-100 dark:bg-pink-900/40",
    text: "text-pink-800 dark:text-pink-300",
    border: "border-pink-300 dark:border-pink-700",
  },
  ELTERNZEIT: {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-800 dark:text-violet-300",
    border: "border-violet-300 dark:border-violet-700",
  },
  SONDERURLAUB: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
  },
  UNBEZAHLT: {
    bg: "bg-gray-100 dark:bg-zinc-800",
    text: "text-gray-700 dark:text-zinc-300",
    border: "border-gray-300 dark:border-zinc-600",
  },
  FORTBILDUNG: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  SONSTIGES: {
    bg: "bg-gray-100 dark:bg-zinc-800",
    text: "text-gray-600 dark:text-zinc-400",
    border: "border-gray-300 dark:border-zinc-600",
  },
};

const SHIFT_STYLE = {
  bg: "bg-gray-200 dark:bg-zinc-700",
  text: "text-gray-800 dark:text-zinc-200",
  border: "border-gray-300 dark:border-zinc-600",
};

const HOLIDAY_STYLE = {
  bg: "bg-emerald-50 dark:bg-emerald-900/20",
  text: "text-emerald-700 dark:text-emerald-400",
};

/* ─── Types ───────────────────────────────────────────────────── */

/** A horizontal bar that spans across days */
interface BarSegment {
  id: string;
  employeeName: string;
  label: string;
  /** 0-based column start within the week (0=Mo, 6=So) */
  colStart: number;
  /** Number of columns to span */
  colSpan: number;
  style: { bg: string; text: string; border: string };
  type: "shift" | "absence";
}

interface WeekRow {
  weekNumber: number;
  days: Date[];
  bars: BarSegment[];
  holidays: { date: Date; name: string }[];
}

/* ─── Props ───────────────────────────────────────────────────── */
interface CalendarGridProps {
  currentDate: Date;
  shifts: CalendarShift[];
  absences: CalendarAbsence[];
  publicHolidays: CalendarHoliday[];
  employees: CalendarEmployee[];
  categoryLabel: (cat: string) => string;
}

const DAY_KEYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DAY_KEYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarGrid({
  currentDate,
  shifts,
  absences,
  publicHolidays,
  employees,
  categoryLabel,
}: CalendarGridProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "en" ? enUS : de;
  const dayHeaders = locale === "en" ? DAY_KEYS_EN : DAY_KEYS;

  const monthLabel = format(currentDate, "MMMM yyyy", {
    locale: dateFnsLocale,
  });

  const weekRows: WeekRow[] = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Get all weeks that overlap this month (weeks start on Monday)
    const weekStarts = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 },
    );

    const empMap = new Map(employees.map((e) => [e.id, e]));

    return weekStarts.map((ws) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: ws, end: we });
      const weekNumber = getCalendarWeek(ws);

      // ── Absence bars ──
      const bars: BarSegment[] = [];

      for (const absence of absences) {
        const absStart = new Date(absence.startDate);
        const absEnd = new Date(absence.endDate);
        // Check if absence overlaps this week
        if (absEnd < ws || absStart > we) continue;

        const clampedStart = absStart < ws ? ws : absStart;
        const clampedEnd = absEnd > we ? we : absEnd;
        const colStart = dayIndex(clampedStart);
        const colSpan = differenceInCalendarDays(clampedEnd, clampedStart) + 1;

        const emp = absence.employee;
        const colors =
          ABSENCE_COLORS[absence.category] ?? ABSENCE_COLORS.SONSTIGES;

        bars.push({
          id: `abs-${absence.id}-w${weekNumber}`,
          employeeName: `${emp.lastName}, ${emp.firstName}`,
          label: `${emp.lastName}, ${emp.firstName} (${categoryLabel(absence.category)})`,
          colStart,
          colSpan,
          style: colors,
          type: "absence",
        });
      }

      // ── Shift bars (group consecutive shift days per employee) ──
      const shiftsByEmp = new Map<string, Date[]>();
      for (const shift of shifts) {
        const sd = new Date(shift.date);
        if (sd < ws || sd > we) continue;
        const empId = shift.employee?.id;
        if (!empId) continue;
        if (!shiftsByEmp.has(empId)) shiftsByEmp.set(empId, []);
        // Deduplicate days
        const existing = shiftsByEmp.get(empId)!;
        if (!existing.some((d) => isSameDay(d, sd))) {
          existing.push(sd);
        }
      }

      for (const [empId, shiftDays] of shiftsByEmp) {
        const emp = empMap.get(empId);
        if (!emp) continue;
        // Sort and merge consecutive days into spans
        const sorted = shiftDays.sort((a, b) => a.getTime() - b.getTime());
        let spanStart = sorted[0];
        let spanEnd = sorted[0];

        for (let i = 1; i <= sorted.length; i++) {
          const next = sorted[i];
          if (next && differenceInCalendarDays(next, spanEnd) === 1) {
            spanEnd = next;
          } else {
            // Emit span
            const colStart = dayIndex(spanStart);
            const colSpan = differenceInCalendarDays(spanEnd, spanStart) + 1;
            bars.push({
              id: `shift-${empId}-${format(spanStart, "yyyy-MM-dd")}`,
              employeeName: `${emp.lastName}, ${emp.firstName}`,
              label: `${emp.lastName}, ${emp.firstName}`,
              colStart,
              colSpan,
              style: SHIFT_STYLE,
              type: "shift",
            });
            if (next) {
              spanStart = next;
              spanEnd = next;
            }
          }
        }
      }

      // ── Holidays ──
      const holidays = publicHolidays
        .filter((h) => {
          const d = new Date(h.date);
          return d >= ws && d <= we;
        })
        .map((h) => ({ date: new Date(h.date), name: h.name }));

      return { weekNumber, days, bars, holidays };
    });
  }, [currentDate, shifts, absences, publicHolidays, employees, categoryLabel]);

  return (
    <div className="space-y-1">
      {/* Month label */}
      <div className="text-center text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
        {monthLabel}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] text-xs font-medium text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-700 pb-1">
        <div /> {/* week number column */}
        {dayHeaders.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weekRows.map((week) => (
        <div
          key={week.weekNumber}
          className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-100 dark:border-zinc-800 min-h-[80px]"
        >
          {/* Week number */}
          <div className="flex items-start pt-2 justify-center text-[11px] font-medium text-gray-400 dark:text-zinc-500">
            W{week.weekNumber}
          </div>

          {/* 7-day grid */}
          <div className="col-span-7 grid grid-cols-7 relative">
            {/* Day number cells */}
            {week.days.map((day) => {
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const isHoliday = week.holidays.some((h) =>
                isSameDay(h.date, day),
              );

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-gray-100 dark:border-zinc-800 last:border-r-0 px-1 pt-1 min-h-[80px] ${
                    !inMonth ? "bg-gray-50/50 dark:bg-zinc-900/50" : ""
                  } ${isHoliday ? HOLIDAY_STYLE.bg : ""}`}
                >
                  <span
                    className={`text-[11px] font-medium ${
                      today
                        ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"
                        : inMonth
                          ? "text-gray-700 dark:text-zinc-300"
                          : "text-gray-300 dark:text-zinc-600"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              );
            })}

            {/* Horizontal bars overlay */}
            <div className="absolute inset-0 pointer-events-none pt-6">
              {/* Holiday bars */}
              {week.holidays.map((h) => {
                const col = dayIndex(h.date);
                return (
                  <div
                    key={`holiday-${h.date.toISOString()}`}
                    className="absolute h-[18px] pointer-events-auto"
                    style={{
                      left: `${(col / 7) * 100}%`,
                      width: `${(1 / 7) * 100}%`,
                      top: "0px",
                    }}
                  >
                    <div
                      className={`mx-0.5 h-full rounded-full px-1.5 flex items-center text-[10px] font-medium truncate border ${HOLIDAY_STYLE.bg} ${HOLIDAY_STYLE.text} border-emerald-200 dark:border-emerald-800`}
                    >
                      {h.name}
                    </div>
                  </div>
                );
              })}

              {/* Shift & absence bars — stacked */}
              {week.bars.map((bar, idx) => {
                const topOffset = 20 + idx * 20;
                return (
                  <div
                    key={bar.id}
                    className="absolute h-[18px] pointer-events-auto"
                    style={{
                      left: `${(bar.colStart / 7) * 100}%`,
                      width: `${(bar.colSpan / 7) * 100}%`,
                      top: `${topOffset}px`,
                    }}
                  >
                    <div
                      className={`mx-0.5 h-full rounded-full px-1.5 flex items-center text-[10px] font-medium truncate border ${bar.style.bg} ${bar.style.text} ${bar.style.border}`}
                      title={bar.label}
                    >
                      {bar.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Get 0-based day index within a week (0=Mon, 6=Sun) */
function dayIndex(date: Date): number {
  const d = date.getDay(); // 0=Sun, 1=Mon, ...
  return d === 0 ? 6 : d - 1;
}
