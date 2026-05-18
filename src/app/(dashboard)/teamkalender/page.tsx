"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  addDays,
  addYears,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  RefreshIcon,
} from "@/components/icons";
import { CalendarGrid } from "./_components/calendar-grid";
import { WeekView } from "./_components/week-view";
import { DayView } from "./_components/day-view";
import { EmployeePlannerGrid } from "./_components/employee-planner-grid";
import { CalendarFilters } from "./_components/calendar-filters";
import { CATEGORY_TO_EVENT_TYPE } from "./_components/types";
import type {
  CalendarShift,
  CalendarAbsence,
  CalendarHoliday,
  CalendarEmployee,
  CalendarDepartment,
  CalendarProject,
  EventType,
} from "./_components/types";

type ViewTab = "employeePlanner" | "calendar" | "projectPlanner";
type PeriodTab = "year" | "month" | "week" | "day";

// category key → legend label CSS
const LEGEND_ITEMS: { key: string; label: string; colorClass: string }[] = [
  {
    key: "shift",
    label: "shift",
    colorClass:
      "bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600",
  },
  {
    key: "vacation",
    label: "vacation",
    colorClass:
      "bg-cyan-100 dark:bg-cyan-900/40 border-cyan-300 dark:border-cyan-700",
  },
  {
    key: "sick",
    label: "sick",
    colorClass:
      "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700",
  },
  {
    key: "parentalLeave",
    label: "parentalLeave",
    colorClass:
      "bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700",
  },
  {
    key: "specialLeave",
    label: "specialLeave",
    colorClass:
      "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700",
  },
  {
    key: "training",
    label: "training",
    colorClass:
      "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700",
  },
  {
    key: "publicHoliday",
    label: "publicHoliday",
    colorClass:
      "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  },
];

export default function TeamkalenderSeite() {
  const t = useTranslations("teamCalendar");
  const tc = useTranslations("common");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>("calendar");
  const [activePeriod, setActivePeriod] = useState<PeriodTab>("month");

  // Data
  const [shifts, setShifts] = useState<CalendarShift[]>([]);
  const [absences, setAbsences] = useState<CalendarAbsence[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<CalendarHoliday[]>([]);
  const [employees, setEmployees] = useState<CalendarEmployee[]>([]);
  const [departments, setDepartments] = useState<CalendarDepartment[]>([]);
  const [projects, setProjects] = useState<CalendarProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown filters
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");

  // Category legend toggles (set of HIDDEN category keys)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set(),
  );

  function toggleCategory(key: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Date range for API fetch — changes with period
  const dateRange = useMemo(() => {
    if (activePeriod === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    if (activePeriod === "day") {
      return { start: currentDate, end: currentDate };
    }
    if (activePeriod === "year") {
      return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    }
    // month
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    };
  }, [currentDate, activePeriod]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");

      const res = await fetch(`/api/calendar?start=${startStr}&end=${endStr}`);
      if (!res.ok) {
        setError(tc("errorLoading"));
        return;
      }
      const data = await res.json();
      setShifts(data.shifts ?? []);
      setAbsences(data.absences ?? []);
      setPublicHolidays(data.publicHolidays ?? []);
      setEmployees(data.employees ?? []);
      setDepartments(data.departments ?? []);
      setProjects(data.projects ?? []);
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [dateRange, tc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSync() {
    setSyncing(true);
    await fetchData();
    setSyncing(false);
  }

  function handleExport() {
    // Server-side CSV: locale-aware headers, BOM, sep=; hint, translated
    // enums, DD.MM.YYYY dates, em-dash for missing times. The browser just
    // navigates to the URL and downloads the file as-is — no Blob assembly,
    // no Excel "Text to Columns" wizard needed.
    const params = new URLSearchParams({
      from: format(dateRange.start, "yyyy-MM-dd"),
      to: format(dateRange.end, "yyyy-MM-dd"),
    });
    if (selectedEmployee) params.set("employeeId", selectedEmployee);
    if (selectedDepartment) params.set("departmentId", selectedDepartment);
    window.location.href = `/api/teamkalender/export?${params.toString()}`;
  }

  // Navigation — advances by the correct unit for the active period
  function navigate(dir: number) {
    setCurrentDate((p) => {
      if (activePeriod === "week") return addWeeks(p, dir);
      if (activePeriod === "day") return addDays(p, dir);
      if (activePeriod === "year") return addYears(p, dir);
      return dir > 0 ? addMonths(p, 1) : subMonths(p, 1);
    });
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  // Filtered data — respects both dropdown filters AND legend toggles
  const filteredShifts = useMemo(() => {
    if (hiddenCategories.has("shift")) return [];
    let result = shifts;
    if (selectedEmployee)
      result = result.filter((s) => s.employee?.id === selectedEmployee);
    if (selectedDepartment)
      result = result.filter(
        (s) => s.employee?.departmentId === selectedDepartment,
      );
    if (selectedEventType && selectedEventType !== "shift") result = [];
    return result;
  }, [
    shifts,
    selectedEmployee,
    selectedDepartment,
    selectedEventType,
    hiddenCategories,
  ]);

  const filteredAbsences = useMemo(() => {
    let result = absences;
    if (selectedEmployee)
      result = result.filter((a) => a.employee?.id === selectedEmployee);
    if (selectedDepartment)
      result = result.filter(
        (a) => a.employee?.departmentId === selectedDepartment,
      );
    if (selectedEventType) {
      const categoryMap: Record<string, string> = {
        vacation: "URLAUB",
        sick: "KRANK",
        parentalLeave: "ELTERNZEIT",
        specialLeave: "SONDERURLAUB",
        unpaidLeave: "UNBEZAHLT",
        training: "FORTBILDUNG",
        other: "SONSTIGES",
      };
      if (
        selectedEventType === "shift" ||
        selectedEventType === "publicHoliday"
      ) {
        result = [];
      } else if (categoryMap[selectedEventType]) {
        result = result.filter(
          (a) => a.category === categoryMap[selectedEventType],
        );
      }
    }
    // Apply legend toggles
    result = result.filter((a) => {
      const eventType = CATEGORY_TO_EVENT_TYPE[a.category] as
        | EventType
        | undefined;
      return eventType ? !hiddenCategories.has(eventType) : true;
    });
    return result;
  }, [
    absences,
    selectedEmployee,
    selectedDepartment,
    selectedEventType,
    hiddenCategories,
  ]);

  const filteredHolidays = useMemo(() => {
    if (hiddenCategories.has("publicHoliday")) return [];
    if (selectedEventType && selectedEventType !== "publicHoliday") return [];
    return publicHolidays;
  }, [publicHolidays, selectedEventType, hiddenCategories]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (selectedDepartment)
      result = result.filter((e) => e.departmentId === selectedDepartment);
    if (selectedEmployee)
      result = result.filter((e) => e.id === selectedEmployee);
    return result;
  }, [employees, selectedDepartment, selectedEmployee]);

  const categoryLabel = useCallback(
    (cat: string): string => {
      const map: Record<string, string> = {
        URLAUB: t("vacation"),
        KRANK: t("sick"),
        ELTERNZEIT: t("parentalLeave"),
        SONDERURLAUB: t("specialLeave"),
        UNBEZAHLT: t("unpaidLeave"),
        FORTBILDUNG: t("training"),
        SONSTIGES: t("other"),
      };
      return map[cat] ?? cat;
    },
    [t],
  );

  const viewTabs: { key: ViewTab; label: string }[] = [
    { key: "employeePlanner", label: t("tabEmployeePlanner") },
    { key: "calendar", label: t("tabCalendar") },
    { key: "projectPlanner", label: t("tabProjectPlanner") },
  ];

  const periodTabs: { key: PeriodTab; label: string }[] = [
    { key: "year", label: t("year") },
    { key: "month", label: t("month") },
    { key: "week", label: t("week") },
    { key: "day", label: t("day") },
  ];

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent className="space-y-5">
        {/* ─── Top action buttons ─────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
          >
            <DownloadIcon className="h-4 w-4" />
            {t("exportCalendar")}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            <RefreshIcon
              className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            {t("syncCalendar")}
          </button>
        </div>

        {/* ─── Filter bar ─────────────────────────────────────── */}
        <CalendarFilters
          projects={projects}
          employees={employees}
          departments={departments}
          selectedProject={selectedProject}
          selectedEmployee={selectedEmployee}
          selectedDepartment={selectedDepartment}
          selectedEventType={selectedEventType}
          onProjectChange={setSelectedProject}
          onEmployeeChange={setSelectedEmployee}
          onDepartmentChange={setSelectedDepartment}
          onEventTypeChange={setSelectedEventType}
        />

        {/* ─── View tabs + Navigation ─────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-700">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveViewTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeViewTab === tab.key
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                    : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Navigation: ◄ Heute ► */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
            </button>
            <button
              onClick={goToday}
              className="rounded-lg border border-gray-200 dark:border-zinc-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {t("today")}
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRightIcon className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
            </button>
          </div>

          {/* Period tabs */}
          <div className="flex items-center gap-1">
            {periodTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActivePeriod(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activePeriod === tab.key
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Calendar content ───────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-500 dark:text-zinc-400">
            {t("loading")}
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] p-4 sm:p-6 overflow-x-auto">
            {/* ── Employee Planner tab ── */}
            {activeViewTab === "employeePlanner" && (
              <EmployeePlannerGrid
                currentDate={currentDate}
                activePeriod={activePeriod}
                employees={filteredEmployees}
                shifts={filteredShifts}
                absences={filteredAbsences}
                publicHolidays={filteredHolidays}
                categoryLabel={categoryLabel}
              />
            )}

            {/* ── Project Planner tab ── */}
            {activeViewTab === "projectPlanner" && (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                  Projektplaner
                </p>
                <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-sm mx-auto">
                  Weise Schichten im{" "}
                  <Link
                    href="/schichtplan"
                    className="text-emerald-600 hover:underline"
                  >
                    Schichtplan
                  </Link>{" "}
                  einem Projekt zu, um hier eine projektbezogene Ansicht zu
                  erhalten.
                </p>
                {projects.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {projects.map((p) => (
                      <span
                        key={p.id}
                        className="rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-zinc-400"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Calendar tab — routes by period ── */}
            {activeViewTab === "calendar" && activePeriod === "week" && (
              <WeekView
                currentDate={currentDate}
                shifts={filteredShifts}
                absences={filteredAbsences}
                publicHolidays={filteredHolidays}
                categoryLabel={categoryLabel}
              />
            )}

            {activeViewTab === "calendar" && activePeriod === "day" && (
              <DayView
                currentDate={currentDate}
                shifts={filteredShifts}
                absences={filteredAbsences}
                publicHolidays={filteredHolidays}
                categoryLabel={categoryLabel}
              />
            )}

            {activeViewTab === "calendar" &&
              (activePeriod === "month" || activePeriod === "year") && (
                <CalendarGrid
                  currentDate={currentDate}
                  shifts={filteredShifts}
                  absences={filteredAbsences}
                  publicHolidays={filteredHolidays}
                  employees={filteredEmployees}
                  categoryLabel={categoryLabel}
                />
              )}

            {/* ─── Legend (clickable toggles) ─────────────────── */}
            {activeViewTab !== "projectPlanner" && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800 pt-3">
                {LEGEND_ITEMS.map((item) => {
                  const hidden = hiddenCategories.has(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggleCategory(item.key)}
                      title={hidden ? "Einblenden" : "Ausblenden"}
                      className={`flex items-center gap-1.5 transition-opacity hover:opacity-80 focus:outline-none ${
                        hidden ? "opacity-35" : ""
                      }`}
                    >
                      <span
                        className={`inline-block h-2.5 w-6 rounded-full border ${item.colorClass} ${
                          hidden ? "opacity-40" : ""
                        }`}
                      />
                      <span className={hidden ? "line-through" : ""}>
                        {t(item.label)}
                      </span>
                    </button>
                  );
                })}
                {hiddenCategories.size > 0 && (
                  <button
                    onClick={() => setHiddenCategories(new Set())}
                    className="ml-auto text-emerald-600 dark:text-emerald-400 hover:underline text-xs"
                  >
                    Alle einblenden
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </PageContent>
    </div>
  );
}
