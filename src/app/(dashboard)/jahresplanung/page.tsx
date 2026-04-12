"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────
interface Absence {
  id: string;
  category: string;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  totalDays: number;
  status: string;
  reason: string | null;
}

interface VacBalance {
  id: string;
  year: number;
  totalEntitlement: number;
  carryOver: number;
  used: number;
  planned: number;
  remaining: number;
}

interface EmployeeSummary {
  totalEntitlement: number;
  carryOver: number;
  used: number;
  planned: number;
  remaining: number;
  approvedVacationDays: number;
  pendingVacationDays: number;
  approvedOvertimeDays: number;
  sickDays: number;
}

interface EmployeeData {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  department: { id: string; name: string } | null;
  absences: Absence[];
  balance: VacBalance | null;
  summary: EmployeeSummary;
}

type ViewTab = "calendar" | "summary";

// ─── Color maps ──────────────────────────────────────────────
const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  URLAUB_GENEHMIGT: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
  },
  URLAUB_AUSSTEHEND: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
  },
  KRANK: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  SONDERURLAUB: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  ELTERNZEIT: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
  },
  UNBEZAHLT: {
    bg: "bg-gray-200",
    text: "text-gray-700",
    border: "border-gray-300 dark:border-zinc-600",
  },
  FORTBILDUNG: {
    bg: "bg-teal-100",
    text: "text-teal-800",
    border: "border-teal-300",
  },
  SONSTIGES: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
  },
};

function getAbsenceColor(category: string, status: string) {
  if (category === "URLAUB") {
    return status === "GENEHMIGT"
      ? CATEGORY_COLORS.URLAUB_GENEHMIGT
      : CATEGORY_COLORS.URLAUB_AUSSTEHEND;
  }
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.SONSTIGES;
}

// ─── Date helpers ────────────────────────────────────────────
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
}

function dateToStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function parseDate(s: string): Date {
  // Handle ISO string or date-only string
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

// ─── Main component ─────────────────────────────────────────
export default function JahresplanungSeite() {
  const t = useTranslations("annualPlanning");
  const [data, setData] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<ViewTab>("calendar");
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/annual-planning?year=${year}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(t("errorLoading"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Derived data ──────────────────────────────────────────
  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    data.forEach((e) => {
      if (e.department) deptMap.set(e.department.id, e.department.name);
    });
    return Array.from(deptMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [data]);

  const filteredEmployees = useMemo(() => {
    if (!departmentFilter) return data;
    return data.filter((e) => e.department?.id === departmentFilter);
  }, [data, departmentFilter]);

  // Build a lookup: employeeId → date string → Absence[]
  const absenceMap = useMemo(() => {
    const map = new Map<string, Map<string, Absence[]>>();
    filteredEmployees.forEach((emp) => {
      const empMap = new Map<string, Absence[]>();
      emp.absences.forEach((abs) => {
        if (abs.status === "ABGELEHNT" || abs.status === "STORNIERT") return;
        const start = parseDate(abs.startDate);
        const end = parseDate(abs.endDate);
        const cur = new Date(start);
        while (cur <= end) {
          const key = dateToStr(cur);
          const list = empMap.get(key) || [];
          list.push(abs);
          empMap.set(key, list);
          cur.setDate(cur.getDate() + 1);
        }
      });
      map.set(emp.id, empMap);
    });
    return map;
  }, [filteredEmployees]);

  // Overlap detection per day: count employees absent
  const overlapMap = useMemo(() => {
    const countByDate = new Map<string, number>();
    absenceMap.forEach((empMap) => {
      empMap.forEach((_, dateKey) => {
        countByDate.set(dateKey, (countByDate.get(dateKey) || 0) + 1);
      });
    });
    return countByDate;
  }, [absenceMap]);

  // ─── Render ────────────────────────────────────────────────
  return (
    <>
      <Topbar title={t("title")} description={t("description")} />

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Controls bar */}
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="rounded-lg border border-gray-300 dark:border-zinc-600 p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              aria-label={t("previousYear")}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <Select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 sm:w-28"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="rounded-lg border border-gray-300 dark:border-zinc-600 p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              aria-label={t("nextYear")}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Department filter + View tabs row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
            {departments.length > 0 && (
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-40 sm:w-48"
              >
                <option value="">{t("allDepartments")}</option>
                {departments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            )}

            {/* View tabs — full width on mobile, auto on sm+ */}
            <div className="w-full sm:w-auto sm:ml-auto inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-zinc-800 p-1">
              <button
                onClick={() => setActiveTab("calendar")}
                className={cn(
                  "flex-1 sm:flex-none rounded-md px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                  activeTab === "calendar"
                    ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                <span className="hidden sm:inline">{t("calendarView")}</span>
                <span className="sm:hidden">{t("calendarViewShort")}</span>
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={cn(
                  "flex-1 sm:flex-none rounded-md px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                  activeTab === "summary"
                    ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                <span className="hidden sm:inline">{t("summaryView")}</span>
                <span className="sm:hidden">{t("summaryViewShort")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <LegendItem
            color="bg-emerald-100 border-emerald-300"
            label={t("vacationApproved")}
          />
          <LegendItem
            color="bg-amber-100 border-amber-300"
            label={t("vacationPending")}
          />
          <LegendItem color="bg-red-100 border-red-300" label={t("sick")} />
          <LegendItem
            color="bg-blue-100 border-blue-300"
            label={t("specialLeave")}
          />
          <LegendItem
            color="bg-purple-100 border-purple-300"
            label={t("parentalLeave")}
          />
          <LegendItem
            color="bg-teal-100 border-teal-300"
            label={t("training")}
          />
          <LegendItem
            color="bg-gray-200 border-gray-300 dark:border-zinc-600"
            label={t("unpaid")}
          />
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-rose-200 border border-rose-400" />
            <span className="text-gray-600">{t("overlapWarning")}</span>
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-sm text-gray-400 dark:text-zinc-500">
            {t("loading")}
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-red-500">{error}</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-20 text-sm text-gray-400 dark:text-zinc-500">
            {t("noEmployees")}
          </div>
        ) : activeTab === "calendar" ? (
          <>
            {/* Year Calendar Grid */}
            {expandedMonth === null ? (
              <YearCalendar
                year={year}
                employees={filteredEmployees}
                absenceMap={absenceMap}
                overlapMap={overlapMap}
                onMonthClick={setExpandedMonth}
                t={t}
              />
            ) : (
              <MonthDetail
                year={year}
                month={expandedMonth}
                employees={filteredEmployees}
                absenceMap={absenceMap}
                overlapMap={overlapMap}
                onClose={() => setExpandedMonth(null)}
                t={t}
              />
            )}
          </>
        ) : (
          <SummaryTable employees={filteredEmployees} year={year} t={t} />
        )}
      </div>
    </>
  );
}

// ─── Legend Item ──────────────────────────────────────────────
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block w-3 h-3 rounded-sm border", color)} />
      <span className="text-gray-600">{label}</span>
    </span>
  );
}

// ─── Year Calendar (12 month mini-grids) ─────────────────────
function YearCalendar({
  year,
  employees,
  absenceMap,
  overlapMap,
  onMonthClick,
  t,
}: {
  year: number;
  employees: EmployeeData[];
  absenceMap: Map<string, Map<string, Absence[]>>;
  overlapMap: Map<string, number>;
  onMonthClick: (month: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 12 }, (_, month) => (
        <MonthMiniCard
          key={month}
          year={year}
          month={month}
          employees={employees}
          absenceMap={absenceMap}
          overlapMap={overlapMap}
          onClick={() => onMonthClick(month)}
          t={t}
        />
      ))}
    </div>
  );
}

// ─── Mini month card ─────────────────────────────────────────
function MonthMiniCard({
  year,
  month,
  employees,
  absenceMap,
  overlapMap,
  onClick,
  t,
}: {
  year: number;
  month: number;
  employees: EmployeeData[];
  absenceMap: Map<string, Map<string, Absence[]>>;
  overlapMap: Map<string, number>;
  onClick: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const daysInMonth = getDaysInMonth(year, month);

  // Count total absences in this month
  const monthAbsences = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateToStr(new Date(year, month, d));
      absenceMap.forEach((empMap) => {
        if (empMap.has(key)) count++;
      });
    }
    return count;
  }, [year, month, daysInMonth, absenceMap]);

  // Max overlap in month
  const maxOverlap = useMemo(() => {
    let max = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateToStr(new Date(year, month, d));
      const ov = overlapMap.get(key) || 0;
      if (ov > max) max = ov;
    }
    return max;
  }, [year, month, daysInMonth, overlapMap]);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-gray-200 dark:border-zinc-700 overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-start justify-between mb-2 gap-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 shrink-0">
            {t(`months.${month}`)}
          </h3>
          <div className="flex flex-wrap items-center justify-end gap-1 text-xs min-w-0">
            {monthAbsences > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 font-medium whitespace-nowrap">
                {monthAbsences} {t("absenceDays")}
              </span>
            )}
            {maxOverlap >= 2 && (
              <span className="rounded-full bg-rose-100 text-rose-700 px-1.5 py-0.5 font-medium whitespace-nowrap">
                ⚠ {maxOverlap}×
              </span>
            )}
          </div>
        </div>

        {/* Mini day grid — employee rows × day columns */}
        <div
          className="-mx-2.5 sm:-mx-3 px-2.5 sm:px-3 overflow-x-auto overscroll-x-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="min-w-max">
            {/* Day numbers header */}
            <div className="flex gap-px mb-px">
              <div className="w-14 shrink-0" />
              {Array.from({ length: daysInMonth }, (_, d) => {
                const day = d + 1;
                const we = isWeekend(year, month, day);
                return (
                  <div
                    key={d}
                    className={cn(
                      "w-3.5 h-3 text-center text-[7px] leading-3 shrink-0",
                      we ? "text-gray-300" : "text-gray-400",
                    )}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Employee rows */}
            {employees.slice(0, 10).map((emp) => {
              const empAbsences = absenceMap.get(emp.id);
              return (
                <div key={emp.id} className="flex gap-px mb-px">
                  <div
                    className="w-14 shrink-0 truncate text-[8px] text-gray-500 dark:text-zinc-400 leading-3 pr-1"
                    title={`${emp.firstName} ${emp.lastName}`}
                  >
                    {emp.lastName}
                  </div>
                  {Array.from({ length: daysInMonth }, (_, d) => {
                    const day = d + 1;
                    const dateKey = dateToStr(new Date(year, month, day));
                    const we = isWeekend(year, month, day);
                    const dayAbs = empAbsences?.get(dateKey);
                    const overlap = (overlapMap.get(dateKey) || 0) >= 2;

                    let cellColor = we
                      ? "bg-gray-50 dark:bg-zinc-800/50"
                      : "bg-white dark:bg-zinc-900";
                    if (dayAbs && dayAbs.length > 0) {
                      const abs = dayAbs[0];
                      const c = getAbsenceColor(abs.category, abs.status);
                      cellColor = c.bg;
                    }

                    return (
                      <div
                        key={d}
                        className={cn(
                          "w-3.5 h-3 shrink-0 rounded-[1px]",
                          cellColor,
                          overlap && dayAbs && dayAbs.length > 0
                            ? "ring-1 ring-rose-400"
                            : "",
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
            {employees.length > 10 && (
              <p className="text-[8px] text-gray-400 dark:text-zinc-500 mt-0.5">
                +{employees.length - 10} {t("more")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Month Detail View ───────────────────────────────────────
function MonthDetail({
  year,
  month,
  employees,
  absenceMap,
  overlapMap,
  onClose,
  t,
}: {
  year: number;
  month: number;
  employees: EmployeeData[];
  absenceMap: Map<string, Map<string, Absence[]>>;
  overlapMap: Map<string, number>;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const daysInMonth = getDaysInMonth(year, month);

  // Group days by week
  const weeks = useMemo(() => {
    const ws: { weekNum: number; days: number[] }[] = [];
    let currentWeek: number[] = [];
    let currentWeekNum = getISOWeek(new Date(year, month, 1));

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const wn = getISOWeek(date);
      if (wn !== currentWeekNum && currentWeek.length > 0) {
        ws.push({ weekNum: currentWeekNum, days: [...currentWeek] });
        currentWeek = [];
        currentWeekNum = wn;
      }
      currentWeek.push(d);
    }
    if (currentWeek.length > 0) {
      ws.push({ weekNum: currentWeekNum, days: [...currentWeek] });
    }
    return ws;
  }, [year, month, daysInMonth]);

  return (
    <Card className="border-gray-200 dark:border-zinc-700">
      <CardContent className="p-0 sm:p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 px-3 sm:px-4 py-3">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-zinc-100">
            {t(`months.${month}`)} {year}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 transition-colors"
            aria-label={t("close")}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable grid */}
        <div
          className="overflow-x-auto overscroll-x-contain -webkit-overflow-scrolling-touch"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 w-44 min-w-[11rem] after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-100 dark:bg-zinc-800 after:content-['']">
                  {t("employee")}
                </th>
                {Array.from({ length: daysInMonth }, (_, d) => {
                  const day = d + 1;
                  const date = new Date(year, month, day);
                  const dow = (date.getDay() + 6) % 7; // Mon=0
                  const we = dow >= 5;
                  return (
                    <th
                      key={d}
                      className={cn(
                        "px-0 py-1 text-center min-w-[2rem] w-8",
                        we ? "bg-gray-50 dark:bg-zinc-800/50" : "",
                      )}
                    >
                      <div
                        className={cn(
                          "text-[9px] font-normal",
                          we ? "text-gray-300" : "text-gray-400",
                        )}
                      >
                        {t(`dayAbbrev.${dow}`)}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium",
                          we ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                        {day}
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* Overlap indicator row */}
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-1 text-[10px] text-gray-400 dark:text-zinc-500 font-medium after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-100 dark:bg-zinc-800 after:content-['']">
                  {t("absenceCount")}
                </td>
                {Array.from({ length: daysInMonth }, (_, d) => {
                  const day = d + 1;
                  const dateKey = dateToStr(new Date(year, month, day));
                  const count = overlapMap.get(dateKey) || 0;
                  const we = isWeekend(year, month, day);
                  return (
                    <td
                      key={d}
                      className={cn(
                        "text-center text-[10px] font-medium px-0 py-1",
                        we
                          ? "bg-gray-50 dark:bg-zinc-800/50 text-gray-300"
                          : "",
                        count >= 3
                          ? "text-rose-600 bg-rose-50"
                          : count >= 2
                            ? "text-amber-600 bg-amber-50"
                            : count >= 1
                              ? "text-gray-500"
                              : "text-gray-200",
                      )}
                    >
                      {count > 0 ? count : "–"}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const empAbsences = absenceMap.get(emp.id);
                return (
                  <tr
                    key={emp.id}
                    className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-1.5 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-100 dark:bg-zinc-800 after:content-['']">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: emp.color || "#9ca3af" }}
                        />
                        <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 truncate max-w-[8rem]">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, d) => {
                      const day = d + 1;
                      const dateKey = dateToStr(new Date(year, month, day));
                      const we = isWeekend(year, month, day);
                      const dayAbs = empAbsences?.get(dateKey);
                      const overlap = (overlapMap.get(dateKey) || 0) >= 2;

                      if (!dayAbs || dayAbs.length === 0) {
                        return (
                          <td
                            key={d}
                            className={cn(
                              "px-0 py-1.5",
                              we ? "bg-gray-50 dark:bg-zinc-800/50" : "",
                            )}
                          />
                        );
                      }

                      const abs = dayAbs[0];
                      const c = getAbsenceColor(abs.category, abs.status);

                      return (
                        <td key={d} className="px-0 py-1.5">
                          <div
                            className={cn(
                              "mx-auto w-6 h-5 rounded-sm flex items-center justify-center text-[8px] font-bold border",
                              c.bg,
                              c.text,
                              c.border,
                              overlap ? "ring-1 ring-rose-400" : "",
                            )}
                            title={`${abs.category} — ${abs.status === "GENEHMIGT" ? t("approved") : t("pending")}`}
                          >
                            {abs.category === "URLAUB"
                              ? abs.status === "GENEHMIGT"
                                ? "✓"
                                : "?"
                              : abs.category === "KRANK"
                                ? "K"
                                : abs.category === "SONDERURLAUB"
                                  ? "S"
                                  : abs.category === "ELTERNZEIT"
                                    ? "E"
                                    : abs.category === "FORTBILDUNG"
                                      ? "F"
                                      : "·"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Week summary at bottom */}
        <div className="border-t border-gray-200 dark:border-zinc-700 px-3 sm:px-4 py-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            {t("weekOverview")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {weeks.map((w) => {
              // Count absences in this week
              let weekAbsCount = 0;
              w.days.forEach((d) => {
                const key = dateToStr(new Date(year, month, d));
                weekAbsCount += overlapMap.get(key) || 0;
              });
              return (
                <div
                  key={w.weekNum}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs",
                    weekAbsCount > 5
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : weekAbsCount > 0
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400",
                  )}
                >
                  <span className="font-medium">
                    {t("calWeek")} {w.weekNum}
                  </span>
                  <span className="ml-1.5">
                    ({w.days[0]}–{w.days[w.days.length - 1]})
                  </span>
                  {weekAbsCount > 0 && (
                    <span className="ml-1.5 font-semibold">
                      {weekAbsCount} {t("absDay")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Year-End Summary Table ──────────────────────────────────
function SummaryTable({
  employees,
  year,
  t,
}: {
  employees: EmployeeData[];
  year: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const totals = useMemo(() => {
    return employees.reduce(
      (acc, emp) => ({
        entitlement: acc.entitlement + emp.summary.totalEntitlement,
        carryOver: acc.carryOver + emp.summary.carryOver,
        used: acc.used + emp.summary.used,
        planned: acc.planned + emp.summary.planned,
        remaining: acc.remaining + emp.summary.remaining,
        approved: acc.approved + emp.summary.approvedVacationDays,
        pending: acc.pending + emp.summary.pendingVacationDays,
        overtime: acc.overtime + emp.summary.approvedOvertimeDays,
        sick: acc.sick + emp.summary.sickDays,
      }),
      {
        entitlement: 0,
        carryOver: 0,
        used: 0,
        planned: 0,
        remaining: 0,
        approved: 0,
        pending: 0,
        overtime: 0,
        sick: 0,
      },
    );
  }, [employees]);

  return (
    <Card className="border-gray-200 dark:border-zinc-700">
      <CardContent className="p-0 sm:p-0">
        <div className="border-b border-gray-200 dark:border-zinc-700 px-3 sm:px-4 py-3">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-zinc-100">
            {t("yearSummary")} {year}
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            {t("yearSummaryDesc")}
          </p>
        </div>

        <div
          className="overflow-x-auto overscroll-x-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-800/50 px-3 sm:px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 w-48 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-['']">
                  {t("employee")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("entitlement")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("carryOver")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("totalAvailable")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("approvedDays")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("pendingDays")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("usedDays")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("remainingDays")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("overtimeDays")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("sickDays")}
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const s = emp.summary;
                const totalAvailable = s.totalEntitlement + s.carryOver;
                const fullyPlanned = s.remaining <= 0;
                const hasResturlaub = s.remaining > 0;

                return (
                  <tr
                    key={emp.id}
                    className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 sm:px-4 py-2.5 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-100 dark:bg-zinc-800 after:content-['']">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: emp.color || "#9ca3af" }}
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                            {emp.firstName} {emp.lastName}
                          </span>
                          {emp.department && (
                            <span className="block text-[10px] text-gray-400 dark:text-zinc-500">
                              {emp.department.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-700 dark:text-zinc-300">
                      {s.totalEntitlement}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-500 dark:text-zinc-400">
                      {s.carryOver > 0 ? `+${s.carryOver}` : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {totalAvailable}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-emerald-600 font-medium">
                      {s.approvedVacationDays}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-amber-600 font-medium">
                      {s.pendingVacationDays > 0 ? s.pendingVacationDays : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-700 dark:text-zinc-300">
                      {s.used}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right text-sm font-semibold",
                        s.remaining <= 0
                          ? "text-gray-400"
                          : s.remaining <= 3
                            ? "text-amber-600"
                            : "text-emerald-600",
                      )}
                    >
                      {s.remaining}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-blue-600">
                      {s.approvedOvertimeDays > 0
                        ? s.approvedOvertimeDays
                        : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-red-500">
                      {s.sickDays > 0 ? s.sickDays : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {fullyPlanned ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          {t("fullyPlanned")}
                        </span>
                      ) : hasResturlaub ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          {t("remainingLeave")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals footer */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-800/50 px-3 sm:px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-['']">
                  {t("total")} ({employees.length} {t("employeesCount")})
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-700 dark:text-zinc-300">
                  {totals.entitlement}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-500 dark:text-zinc-400">
                  {totals.carryOver > 0 ? `+${totals.carryOver}` : "–"}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-900 dark:text-zinc-100">
                  {totals.entitlement + totals.carryOver}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-emerald-600">
                  {totals.approved}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-amber-600">
                  {totals.pending > 0 ? totals.pending : "–"}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-700 dark:text-zinc-300">
                  {totals.used}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-emerald-600">
                  {totals.remaining}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-blue-600">
                  {totals.overtime > 0 ? totals.overtime : "–"}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-red-500">
                  {totals.sick > 0 ? totals.sick : "–"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
