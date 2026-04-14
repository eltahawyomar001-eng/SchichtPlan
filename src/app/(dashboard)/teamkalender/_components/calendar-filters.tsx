"use client";

import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "@/components/icons";
import type {
  CalendarDepartment,
  CalendarEmployee,
  CalendarProject,
} from "./types";

interface CalendarFiltersProps {
  projects: CalendarProject[];
  employees: CalendarEmployee[];
  departments: CalendarDepartment[];
  selectedProject: string;
  selectedEmployee: string;
  selectedDepartment: string;
  selectedEventType: string;
  onProjectChange: (v: string) => void;
  onEmployeeChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onEventTypeChange: (v: string) => void;
}

export function CalendarFilters({
  projects,
  employees,
  departments,
  selectedProject,
  selectedEmployee,
  selectedDepartment,
  selectedEventType,
  onProjectChange,
  onEmployeeChange,
  onDepartmentChange,
  onEventTypeChange,
}: CalendarFiltersProps) {
  const t = useTranslations("teamCalendar");

  const eventTypes: { value: string; label: string }[] = [
    { value: "", label: t("allTypes") },
    { value: "shift", label: t("shift") },
    { value: "vacation", label: t("vacation") },
    { value: "sick", label: t("sick") },
    { value: "parentalLeave", label: t("parentalLeave") },
    { value: "specialLeave", label: t("specialLeave") },
    { value: "unpaidLeave", label: t("unpaidLeave") },
    { value: "training", label: t("training") },
    { value: "other", label: t("other") },
    { value: "publicHoliday", label: t("publicHoliday") },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {/* Projects filter */}
      <FilterSelect
        label={`${t("projects")} (${selectedProject ? 1 : projects.length})`}
        value={selectedProject}
        onChange={onProjectChange}
        options={[
          { value: "", label: t("allProjects") },
          ...projects.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />

      {/* Employees filter */}
      <FilterSelect
        label={`${t("employees")} (${selectedEmployee ? 1 : 0})`}
        value={selectedEmployee}
        onChange={onEmployeeChange}
        options={[
          { value: "", label: t("allEmployees") },
          ...employees.map((e) => ({
            value: e.id,
            label: `${e.lastName}, ${e.firstName}`,
          })),
        ]}
      />

      {/* Departments filter */}
      <FilterSelect
        label={`${t("departments")} (${selectedDepartment ? 1 : 0})`}
        value={selectedDepartment}
        onChange={onDepartmentChange}
        options={[
          { value: "", label: t("allDepartments") },
          ...departments.map((d) => ({ value: d.id, label: d.name })),
        ]}
      />

      {/* Event types filter */}
      <FilterSelect
        label={`${t("eventTypes")} (${selectedEventType ? 1 : eventTypes.length - 1})`}
        value={selectedEventType}
        onChange={onEventTypeChange}
        options={eventTypes}
      />
    </div>
  );
}

/* ─── Reusable Filter Select ─────────────────────────────────── */
function FilterSelect({
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative flex-1 min-w-[160px]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-8 text-sm text-gray-700 dark:text-zinc-300 shadow-sm hover:border-gray-300 dark:hover:border-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <ChevronDownIcon className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
      </div>
    </div>
  );
}
