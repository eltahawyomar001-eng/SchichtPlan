"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

interface ShiftEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  isNightShift?: boolean;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    color: string | null;
  };
}

interface EmployeeInfo {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

/**
 * Derive a visual shift category from time-of-day.
 * German scheduling industry standard:
 *  - Frühschicht: start before 10:00
 *  - Spätschicht: start 10:00–17:59
 *  - Nachtschicht: start >= 18:00 OR flagged isNightShift
 */
function deriveShiftCategory(
  shift: ShiftEntry,
): "FRUEH" | "SPAET" | "NACHT" | "FREI" {
  if (shift.isNightShift) return "NACHT";
  if (shift.status === "CANCELLED") return "FREI";

  const hour = parseInt(shift.startTime.split(":")[0], 10);
  if (hour < 10) return "FRUEH";
  if (hour < 18) return "SPAET";
  return "NACHT";
}

const CATEGORY_COLORS: Record<string, string> = {
  FRUEH: "bg-blue-100 text-blue-800",
  SPAET: "bg-orange-100 text-orange-800",
  NACHT: "bg-purple-100 text-purple-800",
  FREI: "bg-gray-100 text-gray-500",
};

const STATUS_BORDER: Record<string, string> = {
  SCHEDULED: "border-l-2 border-l-gray-400",
  CONFIRMED: "border-l-2 border-l-emerald-500",
  IN_PROGRESS: "border-l-2 border-l-blue-500",
  COMPLETED: "border-l-2 border-l-green-500",
  CANCELLED: "border-l-2 border-l-red-400",
  NO_SHOW: "border-l-2 border-l-red-600",
  OPEN: "border-l-2 border-l-amber-400",
};

export default function TeamkalenderSeite() {
  const t = useTranslations("teamCalendar");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "en" ? enUS : de;
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    };
  }, [currentDate, viewMode]);

  const days = useMemo(
    () => eachDayOfInterval({ start: dateRange.start, end: dateRange.end }),
    [dateRange],
  );

  const padStart = useMemo(() => {
    if (viewMode !== "month") return 0;
    const d = getDay(dateRange.start);
    return d === 0 ? 6 : d - 1;
  }, [viewMode, dateRange.start]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/shifts?start=${startStr}&end=${endStr}`),
        fetch("/api/employees"),
      ]);
      if (!sRes.ok || !eRes.ok) {
        setError(tc("errorLoading"));
        return;
      }
      const sJson = await sRes.json();
      setShifts(sJson.data ?? sJson);
      const eJson = await eRes.json();
      setEmployees(eJson.data ?? (Array.isArray(eJson) ? eJson : []));
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }

  function navigate(dir: number) {
    if (viewMode === "week") {
      setCurrentDate((p) => (dir > 0 ? addWeeks(p, 1) : subWeeks(p, 1)));
    } else {
      setCurrentDate((p) => (dir > 0 ? addMonths(p, 1) : subMonths(p, 1)));
    }
  }

  const headerLabel =
    viewMode === "week"
      ? `${format(dateRange.start, "d. MMM", { locale: dateFnsLocale })} – ${format(dateRange.end, "d. MMM yyyy", { locale: dateFnsLocale })}`
      : format(currentDate, "MMMM yyyy", { locale: dateFnsLocale });

  function shiftsForEmployeeDay(empId: string, day: Date) {
    return shifts.filter(
      (s) => s.employee?.id === empId && isSameDay(new Date(s.date), day),
    );
  }

  const DAY_HEADERS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    return format(d, "EEE", { locale: dateFnsLocale });
  });

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {(["week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                  viewMode === m
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {m === "week" ? t("week") : t("month")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-1 hover:bg-gray-100"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
              {headerLabel}
            </span>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg p-1 hover:bg-gray-100"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Legend */}
          <div className="ml-auto hidden sm:flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-200" />
              {t("early")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-200" />
              {t("late")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-200" />
              {t("night")}
            </span>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-500">{t("loading")}</div>
        ) : viewMode === "week" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-3 py-2 text-left text-gray-600 min-w-[140px]">
                    {t("employee")}
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.toISOString()}
                      className="border-b border-gray-200 px-2 py-2 text-center text-gray-600 min-w-[100px]"
                    >
                      <div>{format(d, "EEE", { locale: dateFnsLocale })}</div>
                      <div className="text-xs font-normal text-gray-400">
                        {format(d, "d.M.")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-100">
                    <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: emp.color || "#10b981" }}
                        />
                        {emp.firstName} {emp.lastName}
                      </div>
                    </td>
                    {days.map((d) => {
                      const dayShifts = shiftsForEmployeeDay(emp.id, d);
                      return (
                        <td
                          key={d.toISOString()}
                          className="px-1 py-1 text-center align-top"
                        >
                          {dayShifts.map((s) => {
                            const cat = deriveShiftCategory(s);
                            return (
                              <div
                                key={s.id}
                                className={`mb-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]} ${STATUS_BORDER[s.status] ?? ""}`}
                              >
                                {s.startTime}–{s.endTime}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={days.length + 1}
                      className="py-8 text-center text-gray-500"
                    >
                      {t("noEmployees")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {employees.map((emp) => (
              <Card key={emp.id} className="overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: emp.color || "#10b981" }}
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    {emp.firstName} {emp.lastName}
                  </span>
                </div>
                <CardContent className="p-0">
                  <div className="grid grid-cols-7 text-center text-xs text-gray-500 border-b border-gray-100">
                    {DAY_HEADERS.map((dh) => (
                      <div key={dh} className="py-1">
                        {dh}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: padStart }).map((_, i) => (
                      <div
                        key={`pad-${i}`}
                        className="border-t border-r border-gray-100 min-h-[48px]"
                      />
                    ))}
                    {days.map((d) => {
                      const dayShifts = shiftsForEmployeeDay(emp.id, d);
                      return (
                        <div
                          key={d.toISOString()}
                          className="border-t border-r border-gray-100 p-1 min-h-[48px]"
                        >
                          <div className="text-xs text-gray-400 mb-0.5">
                            {format(d, "d")}
                          </div>
                          {dayShifts.map((s) => {
                            const cat = deriveShiftCategory(s);
                            return (
                              <div
                                key={s.id}
                                className={`rounded px-1 py-0.5 text-[10px] font-medium leading-tight mb-0.5 ${CATEGORY_COLORS[cat]}`}
                              >
                                {s.startTime}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
            {employees.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                {t("noEmployees")}
              </div>
            )}
          </div>
        )}
      </PageContent>
    </div>
  );
}
