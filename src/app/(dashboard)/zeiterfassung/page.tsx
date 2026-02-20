"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PlusIcon,
  XIcon,
  ClockIcon,
  CheckCircleIcon,
  SearchIcon,
  DownloadIcon,
  EditIcon,
  FilterIcon,
  ChevronDownIcon,
  MapPinIcon,
  CalendarIcon,
} from "@/components/icons";
import {
  formatMinutesToHHmm,
  formatIndustrial,
  getCalendarWeek,
  STATUS_COLORS,
} from "@/lib/time-utils";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import type { SessionUser } from "@/lib/types";

// ─── Constants ──────────────────────────────────────────────────

const STATUS_KEYS = [
  "ENTWURF",
  "EINGEREICHT",
  "KORREKTUR",
  "ZURUECKGEWIESEN",
  "GEPRUEFT",
  "BESTAETIGT",
] as const;

// ─── Types ──────────────────────────────────────────────────────

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

interface AuditEntry {
  id: string;
  action: string;
  changes: string | null;
  comment: string | null;
  performedBy: string;
  performedAt: string;
}

interface TimeEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  breakMinutes: number;
  grossMinutes: number;
  netMinutes: number;
  remarks: string | null;
  status: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  employee: Employee;
  location: Location | null;
  auditLog: AuditEntry[];
}

// ─── Component ──────────────────────────────────────────────────

export default function ZeiterfassungPage() {
  const { data: session } = useSession();
  const t = useTranslations("timeTracking");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "de" ? de : enUS;
  const user = session?.user as SessionUser | undefined;
  const isManager =
    user && ["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "");

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "08:00",
    endTime: "16:00",
    breakStart: "",
    breakEnd: "",
    breakMinutes: 30,
    employeeId: "",
    locationId: "",
    remarks: "",
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);

  // Action states
  const [actionComment, setActionComment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterEmployee) params.set("employeeId", filterEmployee);

      const res = await fetch(`/api/time-entries?${params.toString()}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterEmployee]);

  const fetchMasterData = useCallback(async () => {
    try {
      const [empRes, locRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/locations"),
      ]);
      const [empData, locData] = await Promise.all([
        empRes.json(),
        locRes.json(),
      ]);
      setEmployees(Array.isArray(empData) ? empData : []);
      setLocations(Array.isArray(locData) ? locData : []);
    } catch (error) {
      console.error("Error fetching master data:", error);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchMasterData();
  }, [fetchEntries, fetchMasterData]);

  // ─── Form handlers ─────────────────────────────────────────

  const resetForm = () => {
    setFormData({
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "08:00",
      endTime: "16:00",
      breakStart: "",
      breakEnd: "",
      breakMinutes: 30,
      employeeId: "",
      locationId: "",
      remarks: "",
    });
    setFormErrors([]);
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (entry: TimeEntry) => {
    setFormData({
      date: entry.date.split("T")[0],
      startTime: entry.startTime,
      endTime: entry.endTime,
      breakStart: entry.breakStart ?? "",
      breakEnd: entry.breakEnd ?? "",
      breakMinutes: entry.breakMinutes,
      employeeId: entry.employee.id,
      locationId: entry.location?.id ?? "",
      remarks: entry.remarks ?? "",
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors([]);

    try {
      const url = editingId
        ? `/api/time-entries/${editingId}`
        : "/api/time-entries";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          breakMinutes: Number(formData.breakMinutes),
          breakStart: formData.breakStart || null,
          breakEnd: formData.breakEnd || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setFormErrors(
            data.errors.map((err: { message: string }) => err.message),
          );
        } else {
          setFormErrors([data.error || t("saveError")]);
        }
        return;
      }

      resetForm();
      fetchEntries();
    } catch (error) {
      console.error("Error:", error);
      setFormErrors([t("networkError")]);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Status actions ─────────────────────────────────────────

  const handleStatusAction = async (
    entryId: string,
    action: string,
    comment?: string,
  ) => {
    try {
      const res = await fetch(`/api/time-entries/${entryId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });

      if (res.ok) {
        fetchEntries();
        setSelectedEntry(null);
        setActionComment("");
      } else {
        const data = await res.json();
        alert(data.error || t("error"));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/time-entries/${deleteTarget}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEntries();
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filterEmployee) params.set("employeeId", filterEmployee);
    window.open(`/api/time-entries/export?${params.toString()}`, "_blank");
  };

  // ─── Filtered entries ───────────────────────────────────────

  const filteredEntries = entries.filter((entry) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name =
        `${entry.employee.firstName} ${entry.employee.lastName}`.toLowerCase();
      const loc = entry.location?.name?.toLowerCase() ?? "";
      if (
        !name.includes(q) &&
        !loc.includes(q) &&
        !entry.remarks?.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // ─── Summary stats ─────────────────────────────────────────

  const totalNetMinutes = filteredEntries.reduce((s, e) => s + e.netMinutes, 0);
  const pendingCount = filteredEntries.filter(
    (e) => e.status === "EINGEREICHT",
  ).length;
  const confirmedCount = filteredEntries.filter(
    (e) => e.status === "BESTAETIGT",
  ).length;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isManager && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <DownloadIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t("export")}</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (!isManager && user?.employeeId) {
                  setFormData((p) => ({ ...p, employeeId: user.employeeId! }));
                }
                setShowForm(true);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("newEntry")}</span>
              <span className="sm:hidden">{tc("new")}</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-blue-50 p-2 sm:p-2.5 flex-shrink-0">
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500 break-words">
                    {t("totalHours")}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {formatMinutesToHHmm(totalNetMinutes)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-400 break-words">
                    {formatIndustrial(totalNetMinutes)} {t("industrialHrs")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-purple-50 p-2 sm:p-2.5 flex-shrink-0">
                  <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {t("entries")}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {filteredEntries.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-yellow-50 p-2 sm:p-2.5 flex-shrink-0">
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {t("open")}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {pendingCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-green-50 p-2 sm:p-2.5 flex-shrink-0">
                  <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {t("confirmed")}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {confirmedCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FilterIcon className="h-4 w-4" />
            {t("filter")}
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1">
                    {tc("status")}
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">{tc("all")}</option>
                    {STATUS_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`statuses.${key}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {isManager && (
                  <div>
                    <Label className="text-xs text-gray-500 mb-1">
                      {tc("employee")}
                    </Label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                    >
                      <option value="">{tc("all")}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Entry Form Modal ── */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
            <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {editingId ? t("editEntry") : t("newTimeEntry")}
                  </CardTitle>
                  <button
                    onClick={resetForm}
                    className="rounded-lg p-1 hover:bg-gray-100"
                  >
                    <XIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitForm} className="space-y-4">
                  {formErrors.length > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      {formErrors.map((err, i) => (
                        <p key={i} className="text-sm text-red-600">
                          {err}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
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
                    {isManager ? (
                      <div>
                        <Label htmlFor="employeeId">
                          {t("form.employee")} *
                        </Label>
                        <select
                          id="employeeId"
                          className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                        </select>
                      </div>
                    ) : (
                      <input type="hidden" value={formData.employeeId} />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">{t("form.startTime")} *</Label>
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
                    <div>
                      <Label htmlFor="endTime">{t("form.endTime")} *</Label>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="breakStart">{t("form.breakFrom")}</Label>
                      <Input
                        id="breakStart"
                        type="time"
                        value={formData.breakStart}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            breakStart: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="breakEnd">{t("form.breakTo")}</Label>
                      <Input
                        id="breakEnd"
                        type="time"
                        value={formData.breakEnd}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            breakEnd: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="breakMinutes">
                        {t("form.breakMinutes")}
                      </Label>
                      <Input
                        id="breakMinutes"
                        type="number"
                        min="0"
                        value={formData.breakMinutes}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            breakMinutes: parseInt(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="locationId">{t("form.location")}</Label>
                    <select
                      id="locationId"
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="remarks">{t("form.remarks")}</Label>
                    <textarea
                      id="remarks"
                      rows={2}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, remarks: e.target.value }))
                      }
                      placeholder={t("form.remarksPlaceholder")}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {tc("cancel")}
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting
                        ? t("form.saving")
                        : editingId
                          ? t("form.update")
                          : tc("save")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Entry Detail Modal ── */}
        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
            <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("entryDetails")}</CardTitle>
                  <button
                    onClick={() => {
                      setSelectedEntry(null);
                      setActionComment("");
                    }}
                    className="rounded-lg p-1 hover:bg-gray-100"
                  >
                    <XIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Entry info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">
                      {t("detail.employee")}
                    </span>
                    <p className="font-medium">
                      {selectedEntry.employee.firstName}{" "}
                      {selectedEntry.employee.lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("detail.date")}</span>
                    <p className="font-medium">
                      {format(new Date(selectedEntry.date), "dd.MM.yyyy", {
                        locale: dateFnsLocale,
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("detail.time")}</span>
                    <p className="font-medium">
                      {selectedEntry.startTime} – {selectedEntry.endTime}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("detail.net")}</span>
                    <p className="font-medium">
                      {formatMinutesToHHmm(selectedEntry.netMinutes)} (
                      {formatIndustrial(selectedEntry.netMinutes)} h)
                    </p>
                  </div>
                  {selectedEntry.location && (
                    <div>
                      <span className="text-gray-500">
                        {t("detail.location")}
                      </span>
                      <p className="font-medium">
                        {selectedEntry.location.name}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">{t("detail.status")}</span>
                    <p>
                      <Badge
                        className={STATUS_COLORS[selectedEntry.status] ?? ""}
                      >
                        {t(`statuses.${selectedEntry.status}`)}
                      </Badge>
                    </p>
                  </div>
                  {selectedEntry.remarks && (
                    <div className="col-span-2">
                      <span className="text-gray-500">
                        {t("detail.remarks")}
                      </span>
                      <p className="font-medium">{selectedEntry.remarks}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t pt-4 space-y-3">
                  {/* Employee actions */}
                  {["ENTWURF", "KORREKTUR"].includes(selectedEntry.status) && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          handleStatusAction(selectedEntry.id, "submit")
                        }
                      >
                        {t("submit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          openEditForm(selectedEntry);
                          setSelectedEntry(null);
                        }}
                      >
                        <EditIcon className="h-4 w-4" />
                        {tc("edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(selectedEntry.id)}
                      >
                        {tc("delete")}
                      </Button>
                    </div>
                  )}

                  {/* Manager actions */}
                  {isManager && selectedEntry.status === "EINGEREICHT" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-gray-500">
                          {t("commentOptional")}
                        </Label>
                        <textarea
                          rows={2}
                          className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          value={actionComment}
                          onChange={(e) => setActionComment(e.target.value)}
                          placeholder={t("commentPlaceholder")}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleStatusAction(
                              selectedEntry.id,
                              "approve",
                              actionComment,
                            )
                          }
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          {t("approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleStatusAction(
                              selectedEntry.id,
                              "correct",
                              actionComment,
                            )
                          }
                        >
                          {t("requestCorrection")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            handleStatusAction(
                              selectedEntry.id,
                              "reject",
                              actionComment,
                            )
                          }
                        >
                          {t("reject")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isManager && selectedEntry.status === "GEPRUEFT" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        handleStatusAction(selectedEntry.id, "confirm")
                      }
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      {t("finalConfirm")}
                    </Button>
                  )}
                </div>

                {/* Audit log */}
                {selectedEntry.auditLog.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      {t("auditLog")}
                    </h4>
                    <div className="space-y-2">
                      {selectedEntry.auditLog.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-2 text-xs text-gray-500"
                        >
                          <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                          <div>
                            <span className="font-medium text-gray-700">
                              {log.action}
                            </span>
                            {log.comment && (
                              <span className="ml-1">– {log.comment}</span>
                            )}
                            <p className="text-gray-400">
                              {format(
                                new Date(log.performedAt),
                                "dd.MM.yyyy HH:mm",
                                { locale: dateFnsLocale },
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Entries Table (desktop) / Cards (mobile) ── */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500">{tc("loading")}</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ClockIcon className="h-12 w-12 mb-3" />
                <p className="text-lg font-medium">{t("noEntries")}</p>
                <p className="text-sm">{t("noEntriesHint")}</p>
              </div>
            ) : (
              <>
                {/* ── Mobile card list ── */}
                <div className="divide-y sm:hidden">
                  {filteredEntries.map((entry) => {
                    const d = new Date(entry.date);
                    return (
                      <div
                        key={entry.id}
                        className="p-4 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  entry.employee.color ?? "#6b7280",
                              }}
                            />
                            <span className="font-medium text-gray-900 text-sm">
                              {entry.employee.firstName}{" "}
                              {entry.employee.lastName}
                            </span>
                          </div>
                          <Badge className={STATUS_COLORS[entry.status] ?? ""}>
                            {t(`statuses.${entry.status}`)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {format(d, "dd.MM.yyyy", { locale: dateFnsLocale })}
                          </span>
                          <span>
                            {entry.startTime} – {entry.endTime}
                          </span>
                          <span className="font-medium text-gray-700">
                            {formatMinutesToHHmm(entry.netMinutes)}
                          </span>
                        </div>
                        {entry.location && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPinIcon className="h-3 w-3" />
                            {entry.location.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Mobile total */}
                  <div className="p-4 bg-gray-50/50 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {t("total")}
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatMinutesToHHmm(totalNetMinutes)}
                      <span className="text-xs text-gray-400 ml-1 font-normal">
                        ({formatIndustrial(totalNetMinutes)} h)
                      </span>
                    </span>
                  </div>
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.date")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.employee")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.time")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.break")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.net")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.location")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          {t("table.status")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">
                          {t("table.cw")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => {
                        const d = new Date(entry.date);
                        const kw = getCalendarWeek(d);

                        return (
                          <tr
                            key={entry.id}
                            className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {format(d, "dd.MM.yyyy", {
                                locale: dateFnsLocale,
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      entry.employee.color ?? "#6b7280",
                                  }}
                                />
                                {entry.employee.firstName}{" "}
                                {entry.employee.lastName}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {entry.startTime} – {entry.endTime}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {formatMinutesToHHmm(entry.breakMinutes)}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {formatMinutesToHHmm(entry.netMinutes)}
                              <span className="text-xs text-gray-400 ml-1">
                                ({formatIndustrial(entry.netMinutes)})
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {entry.location ? (
                                <span className="flex items-center gap-1">
                                  <MapPinIcon className="h-3 w-3" />
                                  {entry.location.name}
                                </span>
                              ) : (
                                "–"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                className={STATUS_COLORS[entry.status] ?? ""}
                              >
                                {t(`statuses.${entry.status}`)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {kw}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/50 border-t">
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-right font-medium text-gray-700"
                        >
                          {t("total")}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {formatMinutesToHHmm(totalNetMinutes)}
                          <span className="text-xs text-gray-400 ml-1 font-normal">
                            ({formatIndustrial(totalNetMinutes)} h)
                          </span>
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
