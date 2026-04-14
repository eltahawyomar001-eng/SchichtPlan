"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ── Types ── */
export interface CalendarDay {
  date: string; // ISO date "YYYY-MM-DD"
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  hasShifts: boolean;
  hasAbsences: boolean;
  shiftCount: number;
  absenceCount: number;
}

interface TeamCalendarMiniCardProps {
  days: CalendarDay[];
  title: string;
  monthLabel: string; // e.g. "April 2026"
  dayLabels: string[]; // Mo, Di, Mi, Do, Fr, Sa, So
  shiftsLabel: string;
  absencesLabel: string;
  onMonthChange?: (offset: number) => void;
}

export function TeamCalendarMiniCard({
  days,
  title,
  monthLabel,
  dayLabels,
  shiftsLabel,
  absencesLabel,
}: TeamCalendarMiniCardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = days.find((d) => d.date === selectedDate);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              {monthLabel}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayLabels.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] font-medium text-gray-400 dark:text-zinc-500 py-1"
            >
              {label}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() =>
                setSelectedDate(day.date === selectedDate ? null : day.date)
              }
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg p-1 h-9 transition-all text-xs",
                !day.isCurrentMonth && "text-gray-300 dark:text-zinc-700",
                day.isCurrentMonth &&
                  !day.isToday &&
                  "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800",
                day.isToday &&
                  "bg-emerald-500 text-white font-bold shadow-sm hover:bg-emerald-600",
                selectedDate === day.date &&
                  !day.isToday &&
                  "ring-2 ring-emerald-400 dark:ring-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
              )}
            >
              <span>{day.day}</span>
              {/* Dots */}
              {day.isCurrentMonth && (day.hasShifts || day.hasAbsences) && (
                <div className="flex items-center gap-0.5 absolute -bottom-0.5">
                  {day.hasShifts && (
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full",
                        day.isToday
                          ? "bg-white/70"
                          : "bg-emerald-400 dark:bg-emerald-500",
                      )}
                    />
                  )}
                  {day.hasAbsences && (
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full",
                        day.isToday
                          ? "bg-white/70"
                          : "bg-red-400 dark:bg-red-500",
                      )}
                    />
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-gray-500 dark:text-zinc-400">
              {shiftsLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-[10px] text-gray-500 dark:text-zinc-400">
              {absencesLabel}
            </span>
          </div>
        </div>
        {/* Selected day detail */}
        {selected && selected.isCurrentMonth && (
          <div className="mt-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50 p-2.5 text-xs">
            <p className="font-medium text-gray-700 dark:text-zinc-300">
              {selected.date}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-emerald-600 dark:text-emerald-400">
                {selected.shiftCount} {shiftsLabel}
              </span>
              <span className="text-red-500 dark:text-red-400">
                {selected.absenceCount} {absencesLabel}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
