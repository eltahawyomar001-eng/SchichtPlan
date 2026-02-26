"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { PageContent } from "@/components/ui/page-content";
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  TrashIcon,
  FilterIcon,
  ZapIcon,
} from "@/components/icons";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
  getDay,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import type { SessionUser } from "@/lib/types";
import { isManagement } from "@/lib/authorization";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  status: string;
  employee: Employee;
  location: Location | null;
}

export default function SchichtplanPage() {
  const t = useTranslations("shiftPlan");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "de" ? de : enUS;
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const canManage = user ? isManagement(user) : false;
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterLocationId, setFilterLocationId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month" | "day">("week");
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    startTime: "08:00",
    endTime: "16:00",
    employeeId: "",
    locationId: "",
    notes: "",
    repeatWeeks: 0,
  });

  // Auto-schedule state
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [autoScheduleLoading, setAutoScheduleLoading] = useState(false);
  const [autoScheduleResult, setAutoScheduleResult] = useState<{
    assigned: number;
    unresolved: number;
    totalOpenShifts: number;
    dryRun: boolean;
    runId?: string;
    totalCostEstimate?: number;
    fairnessScore?: number;
    assignments?: Array<{
      employeeName: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      locationName: string | null;
      costEstimate: number;
      reasons: string[];
    }>;
    unresolvedShifts?: Array<{
      shiftDate: string;
      startTime: string;
      endTime: string;
      locationName: string | null;
      reason: string;
    }>;
    employeeHours?: Record<
      string,
      { name: string; scheduled: number; contract: number; ratio: number }
    >;
  } | null>(null);
  const [autoScheduleError, setAutoScheduleError] = useState<string | null>(
    null,
  );
  const [autoScheduleRange, setAutoScheduleRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [autoScheduleWeights, setAutoScheduleWeights] = useState({
    fairness: 40,
    preference: 20,
    cost: 20,
    continuity: 10,
    staffing: 10,
  });
  const [showWeightsConfig, setShowWeightsConfig] = useState(false);
  const [showEmployeeHours, setShowEmployeeHours] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Month view days
  const monthStart = startOfMonth(currentWeek);
  const monthEnd = endOfMonth(currentWeek);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Pad start so first row starts on Monday
  const firstDayOfWeek = getDay(monthStart); // 0=Sun
  const padStart = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  // Day view: single day
  const dayDate = currentWeek;

  const fetchData = useCallback(async () => {
    try {
      let fetchStart: Date, fetchEnd: Date;
      if (viewMode === "month") {
        fetchStart = startOfMonth(currentWeek);
        fetchEnd = endOfMonth(currentWeek);
      } else if (viewMode === "day") {
        fetchStart = currentWeek;
        fetchEnd = currentWeek;
      } else {
        fetchStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
        fetchEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      }
      const startStr = format(fetchStart, "yyyy-MM-dd");
      const endStr = format(fetchEnd, "yyyy-MM-dd");

      const [shiftsRes, employeesRes, locationsRes] = await Promise.all([
        fetch(`/api/shifts?start=${startStr}&end=${endStr}`),
        fetch("/api/employees"),
        fetch("/api/locations"),
      ]);

      const [shiftsJson, employeesJson, locationsJson] = await Promise.all([
        shiftsRes.json(),
        employeesRes.json(),
        locationsRes.json(),
      ]);

      // API returns paginated { data, pagination } — extract the data array
      setShifts(shiftsJson.data ?? shiftsJson);
      setEmployees(employeesJson.data ?? employeesJson);
      setLocations(locationsJson.data ?? locationsJson);
    } catch {
      setLoadError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [currentWeek, viewMode, tc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateForm = (date: Date) => {
    setEditingShift(null);
    setFormData({
      date: format(date, "yyyy-MM-dd"),
      startTime: "08:00",
      endTime: "16:00",
      employeeId: "",
      locationId: "",
      notes: "",
      repeatWeeks: 0,
    });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      date: shift.date.split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      employeeId: shift.employee.id,
      locationId: shift.location?.id || "",
      notes: shift.notes || "",
      repeatWeeks: 0,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const url = editingShift
        ? `/api/shifts/${editingShift.id}`
        : "/api/shifts";
      const method = editingShift ? "PATCH" : "POST";
      const payload = editingShift
        ? { ...formData, repeatWeeks: undefined }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingShift(null);
        setFormError(null);
        setFormData({
          date: "",
          startTime: "08:00",
          endTime: "16:00",
          employeeId: "",
          locationId: "",
          notes: "",
          repeatWeeks: 0,
        });
        fetchData();
      } else {
        const data = await res.json();
        if (res.status === 409 && data.conflicts) {
          const messages = data.conflicts.map(
            (c: { message: string }) => c.message,
          );
          setFormError(messages.join("\n"));
        } else {
          setFormError(data.error || t("saveError"));
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setFormError(t("networkError"));
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/shifts/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchData();
    } catch {
      setLoadError(tc("errorOccurred"));
    }
  };

  const handleAutoSchedule = async (dryRun: boolean) => {
    setAutoScheduleLoading(true);
    setAutoScheduleError(null);
    setAutoScheduleResult(null);
    try {
      let startDate: string, endDate: string;

      if (autoScheduleRange) {
        // Use user-selected range
        startDate = autoScheduleRange.startDate;
        endDate = autoScheduleRange.endDate;
      } else if (viewMode === "month") {
        // For month view, default to current date + 14 days
        startDate = format(new Date(), "yyyy-MM-dd");
        const end14 = new Date();
        end14.setDate(end14.getDate() + 13);
        endDate = format(end14, "yyyy-MM-dd");
      } else if (viewMode === "day") {
        startDate = endDate = format(currentWeek, "yyyy-MM-dd");
      } else {
        startDate = format(weekStart, "yyyy-MM-dd");
        endDate = format(weekEnd, "yyyy-MM-dd");
      }

      // Client-side validation: max 31 days
      const daysDiff =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysDiff > 31) {
        setAutoScheduleError(t("autoScheduleMaxDays"));
        setAutoScheduleLoading(false);
        return;
      }

      const res = await fetch("/api/shifts/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          ...(filterLocationId ? { locationId: filterLocationId } : {}),
          dryRun,
          weights: autoScheduleWeights,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAutoScheduleResult({
          assigned: data.assigned,
          unresolved: data.unresolved,
          totalOpenShifts:
            data.totalOpenShifts ?? data.assigned + data.unresolved,
          dryRun: data.dryRun,
          runId: data.runId,
          totalCostEstimate: data.totalCostEstimate,
          fairnessScore: data.fairnessScore,
          assignments: data.assignments,
          unresolvedShifts: data.unresolvedShifts,
          employeeHours: data.employeeHours,
        });
        if (!dryRun && data.assigned > 0) {
          fetchData(); // Refresh grid
        }
      } else {
        setAutoScheduleError(data.error || tc("errorOccurred"));
      }
    } catch {
      setAutoScheduleError(tc("errorOccurred"));
    } finally {
      setAutoScheduleLoading(false);
    }
  };

  const getShiftsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts
      .filter((s) => s.date.startsWith(dateStr))
      .filter((s) => !filterLocationId || s.location?.id === filterLocationId);
  };

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    const shift = shifts.find((s) => s.id === event.active.id);
    setActiveShift(shift || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveShift(null);
    const { active, over } = event;
    if (!over || !canManage) return;

    const shiftId = active.id as string;
    const newDate = over.id as string; // format: yyyy-MM-dd
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    const currentDate = shift.date.split("T")[0];
    if (currentDate === newDate) return;

    // Optimistic update
    setShifts((prev) =>
      prev.map((s) => (s.id === shiftId ? { ...s, date: newDate } : s)),
    );

    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate }),
      });
      if (!res.ok) fetchData(); // revert on error
    } catch {
      fetchData();
    }
  }

  // Navigation helpers for different view modes
  const navigateBack = () => {
    if (viewMode === "month") setCurrentWeek(subMonths(currentWeek, 1));
    else if (viewMode === "day") {
      const d = new Date(currentWeek);
      d.setDate(d.getDate() - 1);
      setCurrentWeek(d);
    } else setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const navigateForward = () => {
    if (viewMode === "month") setCurrentWeek(addMonths(currentWeek, 1));
    else if (viewMode === "day") {
      const d = new Date(currentWeek);
      d.setDate(d.getDate() + 1);
      setCurrentWeek(d);
    } else setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const headerLabel = () => {
    if (viewMode === "month")
      return format(currentWeek, "MMMM yyyy", { locale: dateFnsLocale });
    if (viewMode === "day")
      return format(currentWeek, "EEEE, d. MMMM yyyy", {
        locale: dateFnsLocale,
      });
    return `${format(weekStart, "d. MMM", { locale: dateFnsLocale })} – ${format(weekEnd, "d. MMM yyyy", { locale: dateFnsLocale })}`;
  };

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <PageContent>
        {/* Load error */}
        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
          </div>
        )}

        {/* Navigation + View Toggle + Location Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" size="icon" onClick={navigateBack}>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 text-center min-w-[140px]">
              {headerLabel()}
            </h2>
            <Button variant="outline" size="icon" onClick={navigateForward}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* View mode toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              {(["day", "week", "month"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    viewMode === mode
                      ? "bg-emerald-100 text-emerald-800"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {mode === "day"
                    ? t("viewDay")
                    : mode === "week"
                      ? t("viewWeek")
                      : t("viewMonth")}
                </button>
              ))}
            </div>
            {/* Location Filter */}
            {locations.length > 0 && (
              <div className="relative flex-1 sm:flex-initial">
                <FilterIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filterLocationId}
                  onChange={(e) => setFilterLocationId(e.target.value)}
                  className="h-9 w-full sm:w-auto appearance-none rounded-xl border border-gray-200 bg-white pl-9 pr-8 text-sm shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-400"
                >
                  <option value="">{t("allLocations")}</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
            >
              {tc("today")}
            </Button>
            {/* Auto-schedule button — management only */}
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAutoSchedule(true);
                  setAutoScheduleResult(null);
                  setAutoScheduleError(null);
                  // Initialize date range based on current view
                  if (viewMode === "month") {
                    const today = format(new Date(), "yyyy-MM-dd");
                    const end14 = new Date();
                    end14.setDate(end14.getDate() + 13);
                    setAutoScheduleRange({
                      startDate: today,
                      endDate: format(end14, "yyyy-MM-dd"),
                    });
                  } else if (viewMode === "day") {
                    const d = format(currentWeek, "yyyy-MM-dd");
                    setAutoScheduleRange({ startDate: d, endDate: d });
                  } else {
                    setAutoScheduleRange({
                      startDate: format(weekStart, "yyyy-MM-dd"),
                      endDate: format(weekEnd, "yyyy-MM-dd"),
                    });
                  }
                }}
                className="gap-1.5"
              >
                <ZapIcon className="h-4 w-4 text-amber-500" />
                <span className="hidden sm:inline">{t("autoSchedule")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">{tc("loading")}</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Month View */}
            {viewMode === "month" && (
              <div className="hidden sm:block">
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
                  {/* Day headers */}
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                    <div
                      key={d}
                      className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500"
                    >
                      {d}
                    </div>
                  ))}
                  {/* Empty pad cells */}
                  {Array.from({ length: padStart }).map((_, i) => (
                    <div
                      key={`pad-${i}`}
                      className="bg-white p-2 min-h-[80px]"
                    />
                  ))}
                  {/* Month day cells */}
                  {monthDays.map((day) => {
                    const dayShifts = getShiftsForDay(day);
                    const today = isToday(day);
                    return (
                      <DroppableDayCell
                        key={day.toISOString()}
                        id={format(day, "yyyy-MM-dd")}
                      >
                        <div
                          className={`bg-white p-1.5 min-h-[80px] ${today ? "ring-2 ring-inset ring-emerald-500" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs font-medium ${today ? "text-emerald-600" : !isSameMonth(day, currentWeek) ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {format(day, "d")}
                            </span>
                            {canManage && (
                              <button
                                onClick={() => openCreateForm(day)}
                                className="text-gray-300 hover:text-gray-600"
                              >
                                <PlusIcon className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {dayShifts.slice(0, 3).map((shift) => (
                              <DraggableShiftChip
                                key={shift.id}
                                shift={shift}
                                canManage={canManage}
                                onEdit={() => openEditForm(shift)}
                              />
                            ))}
                            {dayShifts.length > 3 && (
                              <p className="text-[10px] text-gray-400 text-center">
                                +{dayShifts.length - 3}
                              </p>
                            )}
                          </div>
                        </div>
                      </DroppableDayCell>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day View */}
            {viewMode === "day" && (
              <DroppableDayCell id={format(dayDate, "yyyy-MM-dd")}>
                <Card
                  className={isToday(dayDate) ? "ring-2 ring-emerald-500" : ""}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {format(dayDate, "EEEE, d. MMMM", {
                          locale: dateFnsLocale,
                        })}
                      </CardTitle>
                      {canManage && (
                        <button
                          onClick={() => openCreateForm(dayDate)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {getShiftsForDay(dayDate).length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        {t("noShifts")}
                      </p>
                    ) : (
                      getShiftsForDay(dayDate).map((shift) => (
                        <DraggableShiftCard
                          key={shift.id}
                          shift={shift}
                          canManage={canManage}
                          onEdit={() => openEditForm(shift)}
                          onDelete={() => setDeleteTarget(shift.id)}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              </DroppableDayCell>
            )}

            {/* Week View: Mobile vertical list */}
            {viewMode === "week" && (
              <>
                <div className="space-y-3 sm:hidden">
                  {weekDays.map((day) => {
                    const dayShifts = getShiftsForDay(day);
                    const today = isToday(day);
                    return (
                      <DroppableDayCell
                        key={day.toISOString()}
                        id={format(day, "yyyy-MM-dd")}
                      >
                        <Card
                          className={today ? "ring-2 ring-emerald-500" : ""}
                        >
                          <CardHeader className="pb-2 px-4 pt-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1 ${
                                    today
                                      ? "bg-emerald-600 text-white"
                                      : "bg-gray-100 text-gray-900"
                                  }`}
                                >
                                  <span className="text-[10px] font-medium uppercase leading-tight">
                                    {format(day, "EEE", {
                                      locale: dateFnsLocale,
                                    })}
                                  </span>
                                  <span className="text-lg font-bold leading-tight">
                                    {format(day, "d")}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {dayShifts.length > 0
                                    ? t("shiftsCount", {
                                        count: dayShifts.length,
                                      })
                                    : t("noShifts")}
                                </span>
                              </div>
                              {canManage && (
                                <button
                                  onClick={() => openCreateForm(day)}
                                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                  <PlusIcon className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </CardHeader>
                          {dayShifts.length > 0 && (
                            <CardContent className="px-4 pb-3 space-y-2">
                              {dayShifts.map((shift) => (
                                <DraggableShiftCard
                                  key={shift.id}
                                  shift={shift}
                                  canManage={canManage}
                                  onEdit={() => openEditForm(shift)}
                                  onDelete={() => setDeleteTarget(shift.id)}
                                />
                              ))}
                            </CardContent>
                          )}
                        </Card>
                      </DroppableDayCell>
                    );
                  })}
                </div>

                {/* Desktop: 7-column grid */}
                <div className="hidden sm:block overflow-x-auto p-1">
                  <div className="grid grid-cols-7 gap-4 min-w-[700px]">
                    {weekDays.map((day) => {
                      const dayShifts = getShiftsForDay(day);
                      const today = isToday(day);

                      return (
                        <DroppableDayCell
                          key={day.toISOString()}
                          id={format(day, "yyyy-MM-dd")}
                        >
                          <Card
                            className={today ? "ring-2 ring-emerald-500" : ""}
                          >
                            <CardHeader className="pb-2 px-3 pt-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase">
                                    {format(day, "EEE", {
                                      locale: dateFnsLocale,
                                    })}
                                  </p>
                                  <p
                                    className={`text-lg font-bold ${
                                      today
                                        ? "text-emerald-600"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {format(day, "d")}
                                  </p>
                                </div>
                                {canManage && (
                                  <button
                                    onClick={() => openCreateForm(day)}
                                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                              {dayShifts.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">
                                  {t("noShifts")}
                                </p>
                              ) : (
                                dayShifts.map((shift) => (
                                  <DraggableShiftChip
                                    key={shift.id}
                                    shift={shift}
                                    canManage={canManage}
                                    onEdit={() => openEditForm(shift)}
                                  />
                                ))
                              )}
                            </CardContent>
                          </Card>
                        </DroppableDayCell>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* DnD Drag Overlay */}
            <DragOverlay>
              {activeShift && (
                <div
                  className="rounded-md p-2 text-xs shadow-lg"
                  style={{
                    backgroundColor:
                      (activeShift.employee.color || "#10b981") + "30",
                    borderLeft: `3px solid ${activeShift.employee.color || "#10b981"}`,
                  }}
                >
                  <p className="font-medium text-gray-900">
                    {activeShift.employee.firstName}{" "}
                    {activeShift.employee.lastName}
                  </p>
                  <p className="text-gray-600">
                    {activeShift.startTime} - {activeShift.endTime}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Add/Edit Shift Modal (management only) */}
        <Modal
          open={!!(canManage && showForm)}
          onClose={() => setShowForm(false)}
          title={editingShift ? t("form.editTitle") : t("form.title")}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t("form.date")} *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, date: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">{t("form.start")} *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      startTime: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">{t("form.end")} *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      endTime: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeId">{t("form.employee")} *</Label>
              <Select
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    employeeId: e.target.value,
                  }))
                }
                required
              >
                <option value="">{t("form.selectEmployee")}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationId">{t("form.location")}</Label>
              <Select
                id="locationId"
                value={formData.locationId}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    locationId: e.target.value,
                  }))
                }
              >
                <option value="">{t("form.noLocation")}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("form.notes")}</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder={t("form.notesPlaceholder")}
              />
            </div>

            {/* Repeat weeks (only for new shifts) */}
            {!editingShift && (
              <div className="space-y-2">
                <Label htmlFor="repeatWeeks">{t("form.repeatWeeks")}</Label>
                <Input
                  id="repeatWeeks"
                  type="number"
                  min="0"
                  max="52"
                  value={formData.repeatWeeks}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      repeatWeeks: parseInt(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-xs text-gray-500">
                  {t("form.repeatWeeksHint")}
                </p>
              </div>
            )}

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold mb-1">{t("conflictError")}</p>
                {formError.split("\n").map((line, i) => (
                  <p key={i} className="ml-2">
                    {line}
                  </p>
                ))}
              </div>
            )}

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit">
                {editingShift ? t("form.update") : t("form.submit")}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </PageContent>

      {/* Delete Confirmation Dialog (management only) */}
      {canManage && (
        <ConfirmDialog
          open={!!deleteTarget}
          title={t("deleteConfirmTitle")}
          message={t("deleteConfirmMessage")}
          confirmLabel={tc("delete")}
          cancelLabel={tc("cancel")}
          variant="danger"
          onConfirm={handleDeleteShift}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Auto-schedule modal */}
      <Modal
        open={showAutoSchedule}
        onClose={() => {
          setShowAutoSchedule(false);
          setShowWeightsConfig(false);
          setShowEmployeeHours(false);
        }}
        title={t("autoScheduleTitle")}
        size="lg"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{t("autoScheduleDesc")}</p>

          {/* Date range inputs */}
          {autoScheduleRange && !autoScheduleResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("autoScheduleFrom")}</Label>
                  <Input
                    type="date"
                    value={autoScheduleRange.startDate}
                    onChange={(e) =>
                      setAutoScheduleRange((r) =>
                        r ? { ...r, startDate: e.target.value } : r,
                      )
                    }
                  />
                </div>
                <div>
                  <Label>{t("autoScheduleTo")}</Label>
                  <Input
                    type="date"
                    value={autoScheduleRange.endDate}
                    onChange={(e) =>
                      setAutoScheduleRange((r) =>
                        r ? { ...r, endDate: e.target.value } : r,
                      )
                    }
                  />
                </div>
                <p className="col-span-2 text-xs text-gray-400">
                  {t("autoScheduleMaxDays")}
                </p>
              </div>

              {/* Optimization weights config */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowWeightsConfig((s) => !s)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <span>{showWeightsConfig ? "▼" : "▶"}</span>
                  {t("autoScheduleWeights")}
                </button>
                {showWeightsConfig && (
                  <div className="mt-3 space-y-3 bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">
                      {t("autoScheduleWeightsDesc")}
                    </p>
                    {(
                      [
                        {
                          key: "fairness",
                          label: t("autoScheduleWeightFairness"),
                        },
                        {
                          key: "preference",
                          label: t("autoScheduleWeightPreference"),
                        },
                        { key: "cost", label: t("autoScheduleWeightCost") },
                        {
                          key: "continuity",
                          label: t("autoScheduleWeightContinuity"),
                        },
                        {
                          key: "staffing",
                          label: t("autoScheduleWeightStaffing"),
                        },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 w-32 shrink-0">
                          {label}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={autoScheduleWeights[key]}
                          onChange={(e) =>
                            setAutoScheduleWeights((w) => ({
                              ...w,
                              [key]: parseInt(e.target.value),
                            }))
                          }
                          className="flex-1 accent-emerald-600"
                        />
                        <span className="text-sm font-mono text-gray-500 w-8 text-right">
                          {autoScheduleWeights[key]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {autoScheduleError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {autoScheduleError}
            </div>
          )}

          {autoScheduleResult ? (
            <div className="space-y-4">
              {/* Summary banner */}
              <div
                className={`rounded-xl border p-4 space-y-3 ${autoScheduleResult.dryRun ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
              >
                <p
                  className={`font-medium text-sm ${autoScheduleResult.dryRun ? "text-amber-700" : "text-emerald-700"}`}
                >
                  {autoScheduleResult.dryRun
                    ? t("autoScheduleDryRun")
                    : t("autoScheduleDone")}
                </p>

                {/* Stat cards row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white/70 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-emerald-700">
                      {autoScheduleResult.assigned}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {t("autoScheduleAssigned")}
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-amber-600">
                      {autoScheduleResult.unresolved}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {t("autoScheduleUnresolved")}
                    </p>
                  </div>
                  {autoScheduleResult.fairnessScore != null && (
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-blue-600">
                        {Math.round(autoScheduleResult.fairnessScore * 100)}%
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {t("autoScheduleFairness")}
                      </p>
                    </div>
                  )}
                  {autoScheduleResult.totalCostEstimate != null && (
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-700">
                        €{autoScheduleResult.totalCostEstimate.toFixed(0)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {t("autoScheduleCost")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Fairness score bar */}
                {autoScheduleResult.fairnessScore != null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{t("autoScheduleFairnessLabel")}</span>
                      <span
                        className={
                          autoScheduleResult.fairnessScore >= 0.8
                            ? "text-emerald-600 font-medium"
                            : autoScheduleResult.fairnessScore >= 0.6
                              ? "text-amber-600 font-medium"
                              : "text-red-600 font-medium"
                        }
                      >
                        {autoScheduleResult.fairnessScore >= 0.8
                          ? t("autoScheduleFairnessGood")
                          : autoScheduleResult.fairnessScore >= 0.6
                            ? t("autoScheduleFairnessOk")
                            : t("autoScheduleFairnessPoor")}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          autoScheduleResult.fairnessScore >= 0.8
                            ? "bg-emerald-500"
                            : autoScheduleResult.fairnessScore >= 0.6
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.round(autoScheduleResult.fairnessScore * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Employee hours breakdown */}
              {autoScheduleResult.employeeHours &&
                Object.keys(autoScheduleResult.employeeHours).length > 0 && (
                  <div className="border rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowEmployeeHours((s) => !s)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                    >
                      <span>{t("autoScheduleEmployeeHours")}</span>
                      <span className="text-gray-400">
                        {showEmployeeHours ? "▲" : "▼"}
                      </span>
                    </button>
                    {showEmployeeHours && (
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50/50 text-left text-xs text-gray-500">
                              <th className="px-4 py-1.5 font-medium">
                                {t("autoScheduleEmployee")}
                              </th>
                              <th className="px-4 py-1.5 font-medium text-right">
                                {t("autoScheduleScheduledH")}
                              </th>
                              <th className="px-4 py-1.5 font-medium text-right">
                                {t("autoScheduleContractH")}
                              </th>
                              <th className="px-4 py-1.5 font-medium text-right">
                                {t("autoScheduleUtilization")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(autoScheduleResult.employeeHours)
                              .sort(([, a], [, b]) => b.scheduled - a.scheduled)
                              .map(([id, emp]) => (
                                <tr key={id} className="border-b last:border-0">
                                  <td className="px-4 py-1.5 text-gray-800">
                                    {emp.name}
                                  </td>
                                  <td className="px-4 py-1.5 text-right font-mono">
                                    {emp.scheduled.toFixed(1)}h
                                  </td>
                                  <td className="px-4 py-1.5 text-right font-mono text-gray-500">
                                    {emp.contract.toFixed(1)}h
                                  </td>
                                  <td className="px-4 py-1.5 text-right">
                                    <span
                                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                        emp.ratio > 1
                                          ? "bg-red-100 text-red-700"
                                          : emp.ratio > 0.85
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-emerald-100 text-emerald-700"
                                      }`}
                                    >
                                      {Math.round(emp.ratio * 100)}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              {/* Unresolved shift details */}
              {autoScheduleResult.unresolvedShifts &&
                autoScheduleResult.unresolvedShifts.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1.5">
                      {t("autoScheduleUnresolvedDetails")}
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {autoScheduleResult.unresolvedShifts.map((u, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          📅 {u.shiftDate} {u.startTime}–{u.endTime}
                          {u.locationName ? ` (${u.locationName})` : ""}:{" "}
                          <span className="text-amber-700">{u.reason}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

              {/* Action buttons */}
              {autoScheduleResult.dryRun && (
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    onClick={() => handleAutoSchedule(false)}
                    disabled={autoScheduleLoading}
                  >
                    <ZapIcon className="h-4 w-4 mr-1.5" />
                    {autoScheduleLoading
                      ? tc("loading")
                      : t("autoScheduleApply")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAutoScheduleResult(null);
                      setShowEmployeeHours(false);
                    }}
                  >
                    {t("autoScheduleBack")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => handleAutoSchedule(true)}
                disabled={autoScheduleLoading}
              >
                {autoScheduleLoading ? tc("loading") : t("autoSchedulePreview")}
              </Button>
              <Button
                onClick={() => handleAutoSchedule(false)}
                disabled={autoScheduleLoading}
              >
                <ZapIcon className="h-4 w-4 mr-1.5" />
                {autoScheduleLoading ? tc("loading") : t("autoScheduleRun")}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// --- DnD Components ---

function DroppableDayCell({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${isOver ? "bg-emerald-50/50 ring-2 ring-emerald-300 ring-inset rounded-lg" : ""}`}
    >
      {children}
    </div>
  );
}

function DraggableShiftChip({
  shift,
  canManage,
  onEdit,
}: {
  shift: Shift;
  canManage: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    disabled: !canManage,
  });
  return (
    <div
      ref={setNodeRef}
      {...(canManage ? { ...listeners, ...attributes } : {})}
      onClick={canManage ? onEdit : undefined}
      className={`rounded px-1.5 py-0.5 text-[10px] truncate ${canManage ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-40" : ""}`}
      style={{
        backgroundColor: (shift.employee.color || "#10b981") + "20",
        borderLeft: `2px solid ${shift.employee.color || "#10b981"}`,
      }}
    >
      {shift.employee.firstName.charAt(0)}. {shift.employee.lastName}{" "}
      {shift.startTime}–{shift.endTime}
    </div>
  );
}

function DraggableShiftCard({
  shift,
  canManage,
  onEdit,
  onDelete,
}: {
  shift: Shift;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    disabled: !canManage,
  });
  return (
    <div
      ref={setNodeRef}
      {...(canManage ? { ...listeners, ...attributes } : {})}
      className={`group relative flex items-center gap-3 rounded-lg p-3 ${canManage ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-40" : ""}`}
      style={{
        backgroundColor: (shift.employee.color || "#10b981") + "15",
        borderLeft: `3px solid ${shift.employee.color || "#10b981"}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900">
          {shift.employee.firstName} {shift.employee.lastName}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
          <span>
            {shift.startTime} – {shift.endTime}
          </span>
          {shift.location && (
            <>
              <span className="text-gray-300">·</span>
              <span className="truncate">{shift.location.name}</span>
            </>
          )}
        </div>
      </div>
      {canManage && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-gray-400 hover:bg-white/50 hover:text-emerald-500"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-gray-400 hover:bg-white/50 hover:text-red-500"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
