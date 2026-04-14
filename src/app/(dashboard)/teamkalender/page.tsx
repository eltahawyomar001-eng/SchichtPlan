"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  RefreshIcon,
} from "@/components/icons";
import { CalendarGrid } from "./_components/calendar-grid";
import { CalendarFilters } from "./_components/calendar-filters";
import type {
  CalendarShift,
  CalendarAbsence,
  CalendarHoliday,
  CalendarEmployee,
  CalendarDepartment,
  CalendarProject,
} from "./_components/types";

type ViewTab = "employeePlanner" | "calendar" | "projectPlanner";
type PeriodTab = "year" | "month" | "week" | "day";

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
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");

  // Date range for current view
  const dateRange = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    // Include full weeks that overlap the month
    const start = startOfWeek(ms, { weekStartsOn: 1 });
    const end = endOfWeek(me, { weekStartsOn: 1 });
    return { start, end };
  }, [currentDate]);

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

  // Navigation
  function navigate(dir: number) {
    setCurrentDate((p) => (dir > 0 ? addMonths(p, 1) : subMonths(p, 1)));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  // Apply filters
  const filteredShifts = useMemo(() => {
    let result = shifts;
    if (selectedEmployee) {
      result = result.filter((s) => s.employee?.id === selectedEmployee);
    }
    if (selectedDepartment) {
      result = result.filter(
        (s) => s.employee?.departmentId === selectedDepartment,
      );
    }
    // If event type filter is set and it's not "shift", hide all shifts
    if (selectedEventType && selectedEventType !== "shift") {
      result = [];
    }
    return result;
  }, [shifts, selectedEmployee, selectedDepartment, selectedEventType]);

  const filteredAbsences = useMemo(() => {
    let result = absences;
    if (selectedEmployee) {
      result = result.filter((a) => a.employee?.id === selectedEmployee);
    }
    if (selectedDepartment) {
      result = result.filter(
        (a) => a.employee?.departmentId === selectedDepartment,
      );
    }
    if (selectedEventType) {
      // Map event type back to AbsenceCategory
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
    return result;
  }, [absences, selectedEmployee, selectedDepartment, selectedEventType]);

  const filteredHolidays = useMemo(() => {
    if (selectedEventType && selectedEventType !== "publicHoliday") {
      return [];
    }
    return publicHolidays;
  }, [publicHolidays, selectedEventType]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (selectedDepartment) {
      result = result.filter((e) => e.departmentId === selectedDepartment);
    }
    if (selectedEmployee) {
      result = result.filter((e) => e.id === selectedEmployee);
    }
    return result;
  }, [employees, selectedDepartment, selectedEmployee]);

  // Category label helper
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
          <button className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
            <DownloadIcon className="h-4 w-4" />
            {t("exportCalendar")}
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors">
            <RefreshIcon className="h-4 w-4" />
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
          {/* View tabs: Mitarbeiterplaner | Kalender | Projektplaner */}
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

          {/* Period tabs: Jahr | Monat | Woche | Tag */}
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
            <CalendarGrid
              currentDate={currentDate}
              shifts={filteredShifts}
              absences={filteredAbsences}
              publicHolidays={filteredHolidays}
              employees={filteredEmployees}
              categoryLabel={categoryLabel}
            />

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800 pt-3">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-gray-200 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600" />
                {t("shift")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-cyan-100 dark:bg-cyan-900/40 border border-cyan-300 dark:border-cyan-700" />
                {t("vacation")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-pink-100 dark:bg-pink-900/40 border border-pink-300 dark:border-pink-700" />
                {t("sick")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-300 dark:border-violet-700" />
                {t("parentalLeave")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700" />
                {t("specialLeave")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700" />
                {t("training")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" />
                {t("publicHoliday")}
              </span>
            </div>
          </div>
        )}
      </PageContent>
    </div>
  );
}
