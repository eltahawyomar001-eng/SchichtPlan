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
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  PlusIcon,
  XIcon,
  CheckCircleIcon,
  CalendarOffIcon,
  PaperclipIcon,
} from "@/components/icons";
import { ESignatureBadge } from "@/components/e-signature-badge";
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
  reason: string | null;
  documentUrl: string | null;
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
  { value: "UNBEZAHLT", color: "bg-gray-100 text-gray-700" },
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
    reason: "",
  });

  // Document upload state
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auto-fill employeeId for EMPLOYEE role
  const openForm = useCallback(() => {
    if (!canManage && user?.employeeId) {
      setFormData((prev) => ({ ...prev, employeeId: user.employeeId! }));
    }
    setDocumentUrl(null);
    setDocumentName(null);
    setUploadError(null);
    setShowForm(true);
  }, [canManage, user]);

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // ── Fetch data ──────────────────────────────────────────────

  const fetchAbsences = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/absences?${params}`);
      if (res.ok) setAbsences(await res.json());
    } catch {
      setLoadError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, tc]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) setEmployees(await res.json());
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
        body: JSON.stringify({ ...formData, documentUrl }),
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
          reason: "",
        });
        setDocumentUrl(null);
        setDocumentName(null);
        setUploadError(null);
        fetchAbsences();
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;
        const data = await res.json();
        setLoadError(data.error || tc("errorOccurred"));
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await fetch(`/api/absences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: reviewNotes[id] || null }),
      });
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchAbsences();
    } catch {
      setLoadError(tc("errorOccurred"));
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/absences/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || t("form.uploadError"));
        return;
      }

      setDocumentUrl(data.url);
      setDocumentName(file.name);
    } catch {
      setUploadError(t("form.uploadError"));
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected
      e.target.value = "";
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
            <PlusIcon className="h-4 w-4 mr-2" />
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
                <div className="rounded-xl stat-icon-amber p-2.5">
                  <CalendarOffIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {pending}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 break-words">
                    {t("pending")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {approved}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 break-words">
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
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {totalDays}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 break-words">
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                          {absence.reason && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                              {absence.reason}
                            </p>
                          )}
                          {absence.documentUrl && (
                            <a
                              href={absence.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 mt-1"
                            >
                              <PaperclipIcon className="h-3.5 w-3.5" />
                              {t("form.viewDocument")}
                            </a>
                          )}
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
                              onClick={() =>
                                handleStatusChange(absence.id, "GENEHMIGT")
                              }
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircleIcon className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">
                                {t("approve")}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleStatusChange(absence.id, "ABGELEHNT")
                              }
                            >
                              <XIcon className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">
                                {t("reject")}
                              </span>
                            </Button>
                          </div>
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
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("newRequest")}</CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 hover:bg-gray-100"
                >
                  <XIcon className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div>
                  <Label>{t("form.reason")}</Label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[80px] resize-none"
                    placeholder={t("form.reasonPlaceholder")}
                  />
                </div>

                {/* Document upload */}
                <div>
                  <Label>{t("form.document")}</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    {formData.category === "KRANK"
                      ? t("form.documentHintKrank")
                      : t("form.documentHint")}
                  </p>

                  {documentUrl ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <PaperclipIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 truncate flex-1">
                        {documentName || t("form.uploadSuccess")}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDocumentUrl(null);
                          setDocumentName(null);
                        }}
                        className="text-emerald-500 hover:text-red-500 transition-colors"
                        title={t("form.removeDocument")}
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-3 py-4 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                      {uploading ? (
                        <span className="text-sm text-gray-500">
                          {t("form.uploading")}
                        </span>
                      ) : (
                        <>
                          <PaperclipIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {t("form.document")}
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button type="submit">{t("form.submit")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
