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
import { Select } from "@/components/ui/select";
import { PageContent } from "@/components/ui/page-content";
import { AdaptiveModal } from "@/components/ui/adaptive-modal";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  PlusIcon,
  XIcon,
  CheckCircleIcon,
  CalendarOffIcon,
} from "@/components/icons";
import { ESignatureBadge } from "@/components/e-signature-badge";
import { EauPanel } from "@/components/absences/eau-panel";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import type { SessionUser } from "@/lib/types";
import { isManagement } from "@/lib/authorization";

// ─── Types ──────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

interface AbsenceRequest {
  id: string;
  category: string;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  totalDays: number;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  employee: Employee;
}

// ─── Constants ──────────────────────────────────────────────────

const CATEGORY_KEYS = [
  { value: "URLAUB", color: "bg-emerald-100 text-emerald-700" },
  { value: "KRANK", color: "bg-red-100 text-red-700" },
  { value: "ELTERNZEIT", color: "bg-pink-100 text-pink-700" },
  { value: "SONDERURLAUB", color: "bg-emerald-100 text-emerald-700" },
  { value: "UNBEZAHLT", color: "bg-gray-100 dark:bg-zinc-800 text-gray-700" },
  { value: "FORTBILDUNG", color: "bg-teal-100 text-teal-700" },
  { value: "SONSTIGES", color: "bg-amber-100 text-amber-700" },
];

const STATUS_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "outline"
> = {
  AUSSTEHEND: "warning",
  GENEHMIGT: "success",
  ABGELEHNT: "destructive",
  STORNIERT: "outline",
};

const STATUS_KEYS: Record<string, string> = {
  AUSSTEHEND: "pending",
  GENEHMIGT: "approved",
  ABGELEHNT: "rejected",
  STORNIERT: "cancelled",
};

// ─── Component ──────────────────────────────────────────────────

export default function AbwesenheitenPage() {
  const t = useTranslations("absences");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "de" ? de : enUS;
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const canManage = user ? isManagement(user) : false;
  const { handlePlanLimit } = usePlanLimit();
  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const [formData, setFormData] = useState({
    employeeId: "",
    category: "URLAUB",
    startDate: "",
    endDate: "",
    halfDayStart: false,
    halfDayEnd: false,
  });

  type DayKind = "WORK" | "WEEKEND" | "HOLIDAY" | "VACATION";
  interface PreviewState {
    breakdown: Array<{ date: string; kind: DayKind; holidayName?: string }>;
    deductibleDays: number;
    holidayCount: number;
    bundesland: string;
  }
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Re-run the holiday-aware classifier whenever the date range, half-day
  // flags, or selected employee change. Debounced so quick typing doesn't
  // spam the API.
  useEffect(() => {
    const { employeeId, startDate, endDate, halfDayStart, halfDayEnd } =
      formData;
    if (!employeeId || !startDate || !endDate || startDate > endDate) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/absences/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            startDate,
            endDate,
            halfDayStart,
            halfDayEnd,
          }),
        });
        if (res.ok) {
          setPreview(await res.json());
        } else {
          setPreview(null);
        }
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [formData]);

  // Auto-fill employeeId for EMPLOYEE role
  const openForm = useCallback(() => {
    if (!canManage && user?.employeeId) {
      setFormData((prev) => ({ ...prev, employeeId: user.employeeId! }));
    }
    setShowForm(true);
  }, [canManage, user]);

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [editingAbsence, setEditingAbsence] = useState<AbsenceRequest | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    category: "URLAUB",
    startDate: "",
    endDate: "",
    halfDayStart: false,
    halfDayEnd: false,
  });

  // ── Fetch data ──────────────────────────────────────────────

  const fetchAbsences = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/absences?${params}`);
      if (res.ok) {
        const d = await res.json();
        setAbsences(d.data ?? d);
      }
    } catch {
      setLoadError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const d = await res.json();
        setEmployees(d.data ?? d);
      }
    } catch {
      // Non-critical employee list — silently ignore
    }
  }, []);

  useEffect(() => {
    fetchAbsences();
    fetchEmployees();
  }, [fetchAbsences, fetchEmployees]);

  // ── Handlers ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          employeeId: "",
          category: "URLAUB",
          startDate: "",
          endDate: "",
          halfDayStart: false,
          halfDayEnd: false,
        });
        fetchAbsences();
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;
        const data = await res.json();
        setLoadError(data.message || data.error || tc("errorOccurred"));
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    }
  }

  function openEdit(absence: AbsenceRequest) {
    setEditingAbsence(absence);
    setEditForm({
      category: absence.category,
      startDate: absence.startDate.slice(0, 10),
      endDate: absence.endDate.slice(0, 10),
      halfDayStart: absence.halfDayStart,
      halfDayEnd: absence.halfDayEnd,
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAbsence) return;
    const id = editingAbsence.id;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/absences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.message || data.error || tc("errorOccurred"));
      } else {
        setEditingAbsence(null);
        fetchAbsences();
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleStatusChange(id: string, status: string) {
    if (actionLoading[id]) return; // prevent double-click
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/absences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: reviewNotes[id] || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.message || data.error || tc("errorOccurred"));
      }
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchAbsences();
    } catch {
      setLoadError(tc("errorOccurred"));
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  function getCategoryInfo(cat: string) {
    return CATEGORY_KEYS.find((c) => c.value === cat) || CATEGORY_KEYS[6];
  }

  function formatDateRange(start: string, end: string) {
    const s = format(new Date(start), "dd. MMM", { locale: dateFnsLocale });
    const e = format(new Date(end), "dd. MMM yyyy", { locale: dateFnsLocale });
    return `${s} – ${e}`;
  }

  // ── Summary stats ───────────────────────────────────────────

  const pending = absences.filter((a) => a.status === "AUSSTEHEND").length;
  const approved = absences.filter((a) => a.status === "GENEHMIGT").length;
  const totalDays = absences
    .filter((a) => a.status === "GENEHMIGT")
    .reduce((sum, a) => sum + a.totalDays, 0);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openForm}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newRequest")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <PageContent>
        {/* Load/action error */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl stat-icon-emerald p-2.5">
                  <CalendarOffIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {pending}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 break-words">
                    {t("pending")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl stat-icon-emerald p-2.5">
                  <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {approved}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 break-words">
                    {t("approved")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl stat-icon-emerald p-2.5">
                  <CalendarOffIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {totalDays}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 break-words">
                    {t("totalDays")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "AUSSTEHEND", "GENEHMIGT", "ABGELEHNT"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === s
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? tc("all") : t(STATUS_KEYS[s]) || s}
            </button>
          ))}
        </div>

        {/* Absence list */}
        <Card>
          <CardHeader>
            <CardTitle>{t("requests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">{tc("loading")}</p>
            ) : absences.length === 0 ? (
              <div className="text-center py-10">
                <CalendarOffIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">{t("noRequests")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {absences.map((absence) => {
                  const cat = getCategoryInfo(absence.category);
                  return (
                    <div
                      key={absence.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 sm:p-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{
                            backgroundColor:
                              absence.employee.color || "#059669",
                          }}
                        >
                          {absence.employee.firstName.charAt(0)}
                          {absence.employee.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 break-words">
                            {absence.employee.firstName}{" "}
                            {absence.employee.lastName}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {formatDateRange(
                              absence.startDate,
                              absence.endDate,
                            )}
                            <span className="text-gray-400"> · </span>
                            {absence.totalDays}{" "}
                            {absence.totalDays === 1 ? tc("day") : tc("days")}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cat.color}`}
                            >
                              {t(`categories.${absence.category}`)}
                            </span>
                            <Badge
                              variant={
                                STATUS_VARIANTS[absence.status] || "outline"
                              }
                            >
                              {t(STATUS_KEYS[absence.status]) || absence.status}
                            </Badge>
                          </div>
                          {absence.reviewNote &&
                            absence.status !== "AUSSTEHEND" && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                {t("reviewNoteLabel")}: {absence.reviewNote}
                              </p>
                            )}
                          {(absence.status === "GENEHMIGT" ||
                            absence.status === "ABGELEHNT") && (
                            <ESignatureBadge
                              entityType="AbsenceRequest"
                              entityId={absence.id}
                            />
                          )}
                          {canManage && absence.category === "KRANK" && (
                            <EauPanel
                              absenceId={absence.id}
                              employeeId={absence.employee.id}
                              startDate={absence.startDate}
                            />
                          )}
                        </div>
                      </div>

                      {/* Actions (management only) */}
                      {canManage && absence.status === "AUSSTEHEND" && (
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Input
                            placeholder={t("reviewNotePlaceholder")}
                            value={reviewNotes[absence.id] || ""}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [absence.id]: e.target.value,
                              }))
                            }
                            className="text-xs h-8"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={!!actionLoading[absence.id]}
                              onClick={() =>
                                handleStatusChange(absence.id, "GENEHMIGT")
                              }
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {t("approve")}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!actionLoading[absence.id]}
                              onClick={() =>
                                handleStatusChange(absence.id, "ABGELEHNT")
                              }
                            >
                              <XIcon className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {t("reject")}
                              </span>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Actions (own pending request — employee or manager owner) */}
                      {!canManage &&
                        absence.status === "AUSSTEHEND" &&
                        absence.employee.id === user?.employeeId && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!actionLoading[absence.id]}
                              onClick={() => openEdit(absence)}
                            >
                              <span className="text-xs">{t("edit")}</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!actionLoading[absence.id]}
                              onClick={() => {
                                if (confirm(t("cancelConfirm"))) {
                                  handleStatusChange(absence.id, "STORNIERT");
                                }
                              }}
                              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <XIcon className="h-4 w-4" />
                              <span className="hidden sm:inline text-xs">
                                {t("withdraw")}
                              </span>
                            </Button>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>

      {/* ── New Absence Request Modal ──────────────────────────── */}
      <AdaptiveModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t("newRequest")}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" form="new-absence-form">
              {t("form.submit")}
            </Button>
          </div>
        }
      >
        <form
          id="new-absence-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {canManage ? (
            <div>
              <Label>{t("form.employee")}</Label>
              <Select
                value={formData.employeeId}
                onChange={(e) =>
                  setFormData({ ...formData, employeeId: e.target.value })
                }
                required
              >
                <option value="">{tc("selectPlaceholder")}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <input type="hidden" value={user?.employeeId || ""} />
          )}

          <div>
            <Label>{t("form.category")}</Label>
            <Select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            >
              {CATEGORY_KEYS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {t(`categories.${cat.value}`)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("form.startDate")}</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
              <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={formData.halfDayStart}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      halfDayStart: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                {t("halfDay")}
              </label>
            </div>
            <div>
              <Label>{t("form.endDate")}</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
              />
              <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={formData.halfDayEnd}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      halfDayEnd: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                {t("halfDay")}
              </label>
            </div>
          </div>

          {/* ── Holiday-aware day-count preview ── */}
          {(formData.startDate || formData.endDate) && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-sm">
              {previewLoading && !preview && (
                <p className="text-gray-600 dark:text-zinc-400">
                  {t("preview.loading")}
                </p>
              )}
              {preview && (
                <>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-base font-semibold text-emerald-700 dark:text-emerald-300">
                      {t("preview.deductible", {
                        count: preview.deductibleDays,
                      })}
                    </span>
                    {preview.holidayCount > 0 && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">
                        {t("preview.holidaysExcluded", {
                          count: preview.holidayCount,
                        })}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-500 dark:text-zinc-500">
                      {t("preview.bundesland", {
                        code: preview.bundesland,
                      })}
                    </span>
                  </div>
                  {preview.breakdown.some((d) => d.kind === "HOLIDAY") && (
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-zinc-400">
                      {preview.breakdown
                        .filter((d) => d.kind === "HOLIDAY")
                        .map((d) => (
                          <li key={d.date}>
                            • {d.date} — {d.holidayName}
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </form>
      </AdaptiveModal>

      {/* ── Edit Absence Modal (employee own pending) ─────────── */}
      <AdaptiveModal
        open={!!editingAbsence}
        onClose={() => setEditingAbsence(null)}
        title={t("editRequest")}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingAbsence(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              form="edit-absence-form"
              disabled={!!editingAbsence && !!actionLoading[editingAbsence.id]}
            >
              {t("form.save")}
            </Button>
          </div>
        }
      >
        <form
          id="edit-absence-form"
          onSubmit={handleEditSubmit}
          className="space-y-4"
        >
          <div>
            <Label>{t("form.category")}</Label>
            <Select
              value={editForm.category}
              onChange={(e) =>
                setEditForm({ ...editForm, category: e.target.value })
              }
            >
              {CATEGORY_KEYS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {t(`categories.${cat.value}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("form.startDate")}</Label>
              <Input
                type="date"
                value={editForm.startDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, startDate: e.target.value })
                }
                required
              />
              <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={editForm.halfDayStart}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      halfDayStart: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                {t("halfDay")}
              </label>
            </div>
            <div>
              <Label>{t("form.endDate")}</Label>
              <Input
                type="date"
                value={editForm.endDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, endDate: e.target.value })
                }
                required
              />
              <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={editForm.halfDayEnd}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      halfDayEnd: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                {t("halfDay")}
              </label>
            </div>
          </div>
        </form>
      </AdaptiveModal>
    </div>
  );
}
