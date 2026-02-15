"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  EditIcon,
  TrashIcon,
  FilterIcon,
} from "@/components/icons";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { de, enUS } from "date-fns/locale";

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
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterLocationId, setFilterLocationId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    startTime: "08:00",
    endTime: "16:00",
    employeeId: "",
    locationId: "",
    notes: "",
    repeatWeeks: 0,
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const fetchData = useCallback(async () => {
    try {
      const ws = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const we = endOfWeek(currentWeek, { weekStartsOn: 1 });
      const startStr = format(ws, "yyyy-MM-dd");
      const endStr = format(we, "yyyy-MM-dd");

      const [shiftsRes, employeesRes, locationsRes] = await Promise.all([
        fetch(`/api/shifts?start=${startStr}&end=${endStr}`),
        fetch("/api/employees"),
        fetch("/api/locations"),
      ]);

      const [shiftsData, employeesData, locationsData] = await Promise.all([
        shiftsRes.json(),
        employeesRes.json(),
        locationsRes.json(),
      ]);

      setShifts(shiftsData);
      setEmployees(employeesData);
      setLocations(locationsData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

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
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const getShiftsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts
      .filter((s) => s.date.startsWith(dateStr))
      .filter((s) => !filterLocationId || s.location?.id === filterLocationId);
  };

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Week Navigation + Location Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 text-center">
              {format(weekStart, "d. MMM", { locale: dateFnsLocale })} –{" "}
              {format(weekEnd, "d. MMM yyyy", { locale: dateFnsLocale })}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Location Filter */}
            {locations.length > 0 && (
              <div className="relative flex-1 sm:flex-initial">
                <FilterIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filterLocationId}
                  onChange={(e) => setFilterLocationId(e.target.value)}
                  className="h-9 w-full sm:w-auto appearance-none rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          </div>
        </div>

        {/* Week Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">{tc("loading")}</p>
          </div>
        ) : (
          <>
            {/* Mobile: Vertical day list */}
            <div className="space-y-3 sm:hidden">
              {weekDays.map((day) => {
                const dayShifts = getShiftsForDay(day);
                const today = isToday(day);

                return (
                  <Card
                    key={day.toISOString()}
                    className={today ? "ring-2 ring-blue-500" : ""}
                  >
                    <CardHeader className="pb-2 px-4 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1 ${
                              today
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <span className="text-[10px] font-medium uppercase leading-tight">
                              {format(day, "EEE", { locale: dateFnsLocale })}
                            </span>
                            <span className="text-lg font-bold leading-tight">
                              {format(day, "d")}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {dayShifts.length > 0
                              ? `${dayShifts.length} ${dayShifts.length === 1 ? (locale === "de" ? "Schicht" : "shift") : locale === "de" ? "Schichten" : "shifts"}`
                              : t("noShifts")}
                          </span>
                        </div>
                        <button
                          onClick={() => openCreateForm(day)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </CardHeader>
                    {dayShifts.length > 0 && (
                      <CardContent className="px-4 pb-3 space-y-2">
                        {dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="group relative flex items-center gap-3 rounded-lg p-3"
                            style={{
                              backgroundColor:
                                (shift.employee.color || "#3B82F6") + "15",
                              borderLeft: `3px solid ${
                                shift.employee.color || "#3B82F6"
                              }`,
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900">
                                {shift.employee.firstName}{" "}
                                {shift.employee.lastName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                                <span>
                                  {shift.startTime} – {shift.endTime}
                                </span>
                                {shift.location && (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <span className="truncate">
                                      {shift.location.name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditForm(shift)}
                                className="rounded p-1.5 text-gray-400 hover:bg-white/50 hover:text-blue-500"
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(shift.id)}
                                className="rounded p-1.5 text-gray-400 hover:bg-white/50 hover:text-red-500"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
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
                    <Card
                      key={day.toISOString()}
                      className={today ? "ring-2 ring-blue-500" : ""}
                    >
                      <CardHeader className="pb-2 px-3 pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                              {format(day, "EEE", { locale: dateFnsLocale })}
                            </p>
                            <p
                              className={`text-lg font-bold ${
                                today ? "text-blue-600" : "text-gray-900"
                              }`}
                            >
                              {format(day, "d")}
                            </p>
                          </div>
                          <button
                            onClick={() => openCreateForm(day)}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        {dayShifts.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">
                            {t("noShifts")}
                          </p>
                        ) : (
                          dayShifts.map((shift) => (
                            <div
                              key={shift.id}
                              className="group relative rounded-md p-2 text-xs cursor-pointer"
                              style={{
                                backgroundColor:
                                  (shift.employee.color || "#3B82F6") + "20",
                                borderLeft: `3px solid ${
                                  shift.employee.color || "#3B82F6"
                                }`,
                              }}
                              onClick={() => openEditForm(shift)}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(shift.id);
                                }}
                                className="absolute right-1 top-1 hidden rounded p-0.5 hover:bg-white/50 group-hover:block text-gray-400 hover:text-red-500"
                              >
                                <XIcon className="h-3 w-3" />
                              </button>
                              <p className="font-medium text-gray-900">
                                {shift.employee.firstName.charAt(0)}.{" "}
                                {shift.employee.lastName}
                              </p>
                              <p className="text-gray-600">
                                {shift.startTime} - {shift.endTime}
                              </p>
                              {shift.location && (
                                <p className="text-gray-500 truncate">
                                  {shift.location.name}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Add/Edit Shift Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <Card className="w-full max-w-md mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {editingShift ? t("form.editTitle") : t("form.title")}
                </CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1 hover:bg-gray-100"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </CardHeader>
              <CardContent>
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
                    <select
                      id="employeeId"
                      value={formData.employeeId}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          employeeId: e.target.value,
                        }))
                      }
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      required
                    >
                      <option value="">{t("form.selectEmployee")}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="locationId">{t("form.location")}</Label>
                    <select
                      id="locationId"
                      value={formData.locationId}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          locationId: e.target.value,
                        }))
                      }
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="">{t("form.noLocation")}</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
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
                      <Label htmlFor="repeatWeeks">
                        {t("form.repeatWeeks")}
                      </Label>
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
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <p className="font-semibold mb-1">{t("conflictError")}</p>
                      {formError.split("\n").map((line, i) => (
                        <p key={i} className="ml-2">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
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
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}
