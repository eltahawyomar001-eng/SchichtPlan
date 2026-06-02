"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import { fmtNum } from "@/lib/utils";
import {
  PlusIcon,
  SearchIcon,
  MailIcon,
  PhoneIcon,
  BriefcaseIcon,
  UsersIcon,
  EditIcon,
  AwardIcon,
  MapPinIcon,
  BuildingIcon,
  ClockIcon,
  AlertCircleIcon,
} from "@/components/icons";

interface EmployeeSkill {
  id: string;
  skill: { id: string; name: string };
}

interface LocationItem {
  id: string;
  name: string;
}

/** Live clock-in status for a single employee (from /api/time-entries/clock/team) */
interface TeamMemberStatus {
  employee: { id: string };
  status: "working" | "break" | "offline";
  active: {
    id: string;
    clockInAt: string;
    startTime: string;
    breakStart: string | null;
    breakEnd: string | null;
  } | null;
}

interface DepartmentItem {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  hourlyRate: number | null;
  weeklyHours: number | null;
  workDaysPerWeek: number;
  contractType: string;
  flexibleWork: boolean;
  color: string | null;
  isActive: boolean;
  pinHash: string | null;
  employeeSkills?: EmployeeSkill[];
  locationId?: string | null;
  location?: LocationItem | null;
  departments?: { department: DepartmentItem }[];
  user?: { id: string; role: string } | null;
  datevPersonnelNumber?: string | null;
  employmentStartDate?: string | null;
  dateOfBirth?: string | null;
  socialSecurityNumber?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
}

export default function MitarbeiterPage() {
  const t = useTranslations("employeesPage");
  const tc = useTranslations("common");
  const tq = useTranslations("qrStation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handlePlanLimit } = usePlanLimit();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [teamStatusMap, setTeamStatusMap] = useState<
    Record<string, TeamMemberStatus>
  >({});
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    hourlyRate: "",
    weeklyHours: "",
    workDaysPerWeek: "5",
    contractType: "VOLLZEIT",
    flexibleWork: false,
    color: "#10b981",
    locationId: "",
    departmentIds: [] as string[],
    role: "",
    datevPersonnelNumber: "",
    employmentStartDate: "",
    dateOfBirth: "",
    socialSecurityNumber: "",
    birthPlace: "",
    nationality: "",
  });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialFormDataRef = useRef(formData);
  const [pinSendingId, setPinSendingId] = useState<string | null>(null);
  const [pinSentId, setPinSentId] = useState<string | null>(null);
  const [employeeLimit, setEmployeeLimit] = useState<number | null>(null);
  const [unpinnedCount, setUnpinnedCount] = useState(0);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  /** Check whether the form has been modified compared to its initial state */
  const isFormDirty = useCallback(() => {
    const initial = initialFormDataRef.current;
    return Object.keys(initial).some(
      (key) =>
        formData[key as keyof typeof formData] !==
        initial[key as keyof typeof initial],
    );
  }, [formData]);

  /** preventClose callback — shows discard confirm when form is dirty */
  const handlePreventClose = useCallback(() => {
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
      return true; // prevent close
    }
    return false; // allow close
  }, [isFormDirty]);

  /** Discard changes and close the form */
  const handleDiscardAndClose = useCallback(() => {
    setShowDiscardConfirm(false);
    setShowForm(false);
    setEditingEmployee(null);
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      const list: Employee[] = data.data ?? data;
      setEmployees(list);
      setUnpinnedCount(list.filter((e) => !e.pinHash && e.isActive).length);
    } catch {
      setError(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  const runBackfill = useCallback(async () => {
    setBackfillRunning(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/backfill-pins", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBackfillResult(
          tq("backfillDone", {
            assigned: data.assigned,
            emailed: data.emailed,
          }),
        );
        fetchEmployees();
      } else {
        setBackfillResult(data.message ?? data.error ?? tq("backfillError"));
      }
    } catch {
      setBackfillResult(tq("backfillError"));
    } finally {
      setBackfillRunning(false);
    }
  }, [tq, fetchEmployees]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data.data ?? data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.data ?? data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  /** Fetch live clock-in status for all employees */
  const fetchTeamStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries/clock/team");
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, TeamMemberStatus> = {};
        for (const member of data.team ?? []) {
          map[member.employee.id] = member;
        }
        setTeamStatusMap(map);
      }
    } catch {
      // Non-critical — live status is a nice-to-have
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
    fetchDepartments();
    fetchTeamStatus();
    fetch("/api/billing/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.employees?.limit != null) setEmployeeLimit(d.employees.limit);
      })
      .catch(() => {});
  }, [fetchEmployees, fetchLocations, fetchDepartments, fetchTeamStatus]);

  // Auto-open edit form when navigated from detail page with ?edit=<id>
  // (placed after openEditForm so it can reference it)
  const editParamHandled = useRef(false);

  const openCreateForm = () => {
    setEditingEmployee(null);
    const initial = {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      hourlyRate: "",
      weeklyHours: "",
      workDaysPerWeek: "5",
      contractType: "VOLLZEIT",
      flexibleWork: false,
      color: "#10b981",
      locationId: "",
      departmentIds: [] as string[],
      role: "",
      datevPersonnelNumber: "",
      employmentStartDate: "",
      dateOfBirth: "",
      socialSecurityNumber: "",
      birthPlace: "",
      nationality: "",
    };
    setFormData(initial);
    initialFormDataRef.current = initial;
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (emp: Employee) => {
    setEditingEmployee(emp);
    const initial = {
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email || "",
      phone: emp.phone || "",
      position: emp.position || "",
      hourlyRate: emp.hourlyRate?.toString() || "",
      weeklyHours: emp.weeklyHours?.toString() || "",
      workDaysPerWeek: emp.workDaysPerWeek?.toString() || "5",
      contractType: emp.contractType || "VOLLZEIT",
      flexibleWork: emp.flexibleWork ?? false,
      color: emp.color || "#10b981",
      locationId: emp.locationId || "",
      departmentIds: emp.departments?.map((d) => d.department.id) ?? [],
      role: emp.user?.role || "",
      datevPersonnelNumber: emp.datevPersonnelNumber ?? "",
      employmentStartDate: emp.employmentStartDate
        ? emp.employmentStartDate.slice(0, 10)
        : "",
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : "",
      socialSecurityNumber: emp.socialSecurityNumber ?? "",
      birthPlace: emp.birthPlace ?? "",
      nationality: emp.nationality ?? "",
    };
    setFormData(initial);
    initialFormDataRef.current = initial;
    setFormError(null);
    setShowForm(true);
  };

  // Effect: auto-open edit form when navigated with ?edit=<id>
  useEffect(() => {
    if (editParamHandled.current || loading || employees.length === 0) return;
    const editId = searchParams.get("edit");
    if (editId) {
      const emp = employees.find((e) => e.id === editId);
      if (emp) {
        openEditForm(emp);
        editParamHandled.current = true;
        // Clean up the URL without navigation
        router.replace("/mitarbeiter", { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, loading, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setSaving(true);
    try {
      const url = editingEmployee
        ? `/api/employees/${editingEmployee.id}`
        : "/api/employees";
      const method = editingEmployee ? "PATCH" : "POST";

      // Strip empty role to avoid sending it on create
      const { role, ...rest } = formData;
      const payload = role ? { ...rest, role } : rest;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Surface the invitation outcome so "did the email go out?" is never a
        // silent unknown (only on create, not edit).
        if (!editingEmployee) {
          const data = await res.json().catch(() => null);
          if (data?.invitationSent) {
            toast.success(t("inviteSent"));
          } else if (data?.invitationFailed) {
            toast.error(t("inviteFailed"));
          }
        }
        setShowForm(false);
        setEditingEmployee(null);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          position: "",
          hourlyRate: "",
          weeklyHours: "",
          workDaysPerWeek: "5",
          contractType: "VOLLZEIT",
          flexibleWork: false,
          color: "#10b981",
          locationId: "",
          departmentIds: [] as string[],
          role: "",
          datevPersonnelNumber: "",
          employmentStartDate: "",
          dateOfBirth: "",
          socialSecurityNumber: "",
          birthPlace: "",
          nationality: "",
        });
        fetchEmployees();
        window.dispatchEvent(new Event("shiftfy:usage-changed"));
      } else {
        // Intercept plan-limit errors with upgrade modal
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;

        const data = await res.json();
        // Show field-level validation details if available
        if (
          data.details &&
          Array.isArray(data.details) &&
          data.details.length > 0
        ) {
          const fieldErrors = data.details
            .map((d: { field?: string; message?: string }) =>
              d.field ? `${d.field}: ${d.message}` : d.message,
            )
            .join(", ");
          setFormError(fieldErrors);
        } else {
          setFormError(data.message || data.error || t("saveError"));
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setFormError(t("networkError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/employees/${deleteTarget}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message ?? tc("errorOccurred"));
        return;
      }
      setDeleteTarget(null);
      fetchEmployees();
      window.dispatchEvent(new Event("shiftfy:usage-changed"));
    } catch {
      toast.error(tc("errorOccurred"));
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...emp, isActive: !emp.isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message ?? tc("errorOccurred"));
        return;
      }
      fetchEmployees();
      window.dispatchEvent(new Event("shiftfy:usage-changed"));
    } catch {
      toast.error(tc("errorOccurred"));
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName} ${emp.position || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const isAtEmployeeLimit =
    employeeLimit !== null && employees.length >= employeeLimit;

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            size="sm"
            onClick={openCreateForm}
            disabled={isAtEmployeeLimit}
            title={
              isAtEmployeeLimit
                ? t("limitReached", {
                    used: employees.length,
                    limit: employeeLimit,
                  })
                : undefined
            }
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newEmployee")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <PageContent>
        {/* Plan limit warning */}
        {isAtEmployeeLimit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t("limitReached", {
              used: employees.length,
              limit: employeeLimit,
            })}
          </div>
        )}

        {/* PIN backfill banner — shown when active employees have no PIN */}
        {unpinnedCount > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>{tq("backfillBanner", { count: unpinnedCount })}</span>
            <div className="flex items-center gap-2 shrink-0">
              {backfillResult && (
                <span className="text-xs text-blue-600">{backfillResult}</span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={runBackfill}
                disabled={backfillRunning}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                {backfillRunning ? tq("backfillRunning") : tq("backfillRun")}
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-full sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 sm:left-3 sm:h-4 sm:w-4" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-11 sm:ps-10"
          />
        </div>

        {/* Add/Edit Employee Modal */}
        <AdaptiveModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editingEmployee ? t("form.editTitle") : t("form.title")}
          size="lg"
          preventClose={handlePreventClose}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Persönliche Daten ── */}
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-zinc-500">
                {t("form.sectionPersonal")}
              </p>
              <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("form.firstName")} *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      firstName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("form.lastName")} *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      lastName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("form.email")} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                required
                placeholder={t("form.emailPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("form.phone")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">{t("form.position")}</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    position: e.target.value,
                  }))
                }
              />
            </div>

            {/* ── Arbeitsstunden ── */}
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-zinc-500">
                {t("form.sectionWorkHours")}
              </p>
              <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">{t("form.hourlyRate")}</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRate}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      hourlyRate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyHours">{t("form.weeklyHours")}</Label>
                <Input
                  id="weeklyHours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.weeklyHours}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      weeklyHours: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workDaysPerWeek">
                  {t("form.workDaysPerWeek")}
                </Label>
                <Input
                  id="workDaysPerWeek"
                  type="number"
                  step="1"
                  min="1"
                  max="7"
                  value={formData.workDaysPerWeek}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      workDaysPerWeek: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractType">{t("form.contractType")}</Label>
                <Select
                  id="contractType"
                  value={formData.contractType}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      contractType: e.target.value,
                    }))
                  }
                >
                  <option value="VOLLZEIT">{t("form.contractVollzeit")}</option>
                  <option value="TEILZEIT">{t("form.contractTeilzeit")}</option>
                  <option value="MINIJOB">{t("form.contractMinijob")}</option>
                  <option value="MIDIJOB">{t("form.contractMidijob")}</option>
                </Select>
              </div>
            </div>

            {/* Flexible work mode */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {t("form.flexibleWork")}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  {t("form.flexibleWorkDesc")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.flexibleWork}
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    flexibleWork: !p.flexibleWork,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  formData.flexibleWork
                    ? "bg-emerald-500"
                    : "bg-gray-200 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                    formData.flexibleWork ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* ── Zugangsdaten ── */}
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-zinc-500">
                {t("form.sectionAccess")}
              </p>
              <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
            </div>

            {/* Role — shown when editing */}
            {editingEmployee && (
              <div className="space-y-2">
                <Label htmlFor="role">{t("form.role")}</Label>
                {editingEmployee.user ? (
                  <Select
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        role: e.target.value,
                      }))
                    }
                  >
                    <option value="OWNER">{t("form.roleOwner")}</option>
                    <option value="ADMIN">{t("form.roleAdmin")}</option>
                    <option value="MANAGER">{t("form.roleManager")}</option>
                    <option value="EMPLOYEE">{t("form.roleEmployee")}</option>
                  </Select>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 italic">
                    {t("form.noLinkedUser")}
                  </p>
                )}
              </div>
            )}

            {/* Location */}
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

            {/* Objekt — multi-select */}
            <div className="space-y-2">
              <Label>{t("form.object")}</Label>
              {/* Selected badges */}
              {formData.departmentIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.departmentIds.map((id) => {
                    const dep = departments.find((d) => d.id === id);
                    if (!dep) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                      >
                        {dep.name}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              departmentIds: p.departmentIds.filter(
                                (d) => d !== id,
                              ),
                            }))
                          }
                          className="ml-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 p-0.5 transition-colors"
                          aria-label={`${dep.name} entfernen`}
                        >
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 10 10"
                            fill="currentColor"
                          >
                            <path d="M6.414 5l2.293-2.293a1 1 0 00-1.414-1.414L5 3.586 2.707 1.293A1 1 0 001.293 2.707L3.586 5 1.293 7.293a1 1 0 001.414 1.414L5 6.414l2.293 2.293a1 1 0 001.414-1.414L6.414 5z" />
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Dropdown to add */}
              <Select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setFormData((p) => ({
                    ...p,
                    departmentIds: p.departmentIds.includes(val)
                      ? p.departmentIds
                      : [...p.departmentIds, val],
                  }));
                  e.target.value = "";
                }}
              >
                <option value="">
                  {departments.filter(
                    (d) => !formData.departmentIds.includes(d.id),
                  ).length === 0
                    ? t("form.allObjectsSelected")
                    : t("form.addObject")}
                </option>
                {departments
                  .filter((d) => !formData.departmentIds.includes(d.id))
                  .map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">{t("form.color")}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, color: e.target.value }))
                  }
                  className="h-9 w-12 rounded-lg border border-gray-200 dark:border-zinc-700 cursor-pointer p-0.5"
                />
              </div>
            </div>

            {/* ── DATEV ── */}
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-zinc-500">
                DATEV
              </p>
              <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="datevPersonnelNumber">
                {t("form.datevPersonnelNumber")}
              </Label>
              <Input
                id="datevPersonnelNumber"
                value={formData.datevPersonnelNumber}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    datevPersonnelNumber: e.target.value,
                  }))
                }
                placeholder="z.B. 1"
                maxLength={20}
              />
            </div>

            {/* ── SV-Stammdaten (für Sofortmeldung / eAU) ── */}
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-zinc-500">
                {t("form.svSection")}
              </p>
              <div className="h-px flex-1 bg-gray-100 dark:bg-zinc-800" />
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 -mt-2">
              {t("form.svSectionHint")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employmentStartDate">
                  {t("form.employmentStartDate")}
                </Label>
                <Input
                  id="employmentStartDate"
                  type="date"
                  value={formData.employmentStartDate}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      employmentStartDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">{t("form.dateOfBirth")}</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      dateOfBirth: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="socialSecurityNumber">
                {t("form.socialSecurityNumber")}
              </Label>
              <Input
                id="socialSecurityNumber"
                value={formData.socialSecurityNumber}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    socialSecurityNumber: e.target.value,
                  }))
                }
                placeholder="z.B. 12345678A123"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {t("form.socialSecurityNumberHint")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthPlace">{t("form.birthPlace")}</Label>
                <Input
                  id="birthPlace"
                  value={formData.birthPlace}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      birthPlace: e.target.value,
                    }))
                  }
                  placeholder="z.B. Berlin"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">{t("form.nationality")}</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      nationality: e.target.value,
                    }))
                  }
                  placeholder="z.B. DE"
                  maxLength={50}
                />
              </div>
            </div>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isFormDirty()) {
                    setShowDiscardConfirm(true);
                  } else {
                    setShowForm(false);
                    setEditingEmployee(null);
                  }
                }}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? tc("saving")
                  : editingEmployee
                    ? tc("save")
                    : t("addEmployee")}
              </Button>
            </ModalFooter>
          </form>
        </AdaptiveModal>

        {/* Employee List */}
        {loading ? (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded shimmer" />
                    <div className="h-3 w-20 rounded shimmer" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-48 rounded shimmer" />
                  <div className="h-3 w-36 rounded shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          search ? (
            <EmptyState
              icon={<UsersIcon className="h-8 w-8 text-emerald-500" />}
              title={t("noSearchResults")}
              description={t("noSearchResultsHint")}
            />
          ) : (
            <EmptyState
              icon={<UsersIcon className="h-8 w-8 text-emerald-500" />}
              title={t("noEmployees")}
              description={t("noEmployeesHint")}
              tips={[t("emptyTip1"), t("emptyTip2"), t("emptyTip3")]}
              actions={[{ label: t("addEmployee"), onClick: openCreateForm }]}
            />
          )
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className={`card-elevated ${!employee.isActive ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar
                        name={`${employee.firstName} ${employee.lastName}`}
                        color={employee.color || "#10b981"}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                          {employee.firstName} {employee.lastName}
                        </p>
                        {employee.position && (
                          <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                            {employee.position}
                          </p>
                        )}
                        {employee.user?.role && (
                          <Badge
                            className={
                              employee.user.role === "OWNER"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]"
                                : employee.user.role === "ADMIN"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px]"
                                  : employee.user.role === "MANAGER"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px]"
                                    : "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-600 text-[10px]"
                            }
                          >
                            {t(
                              `form.role${employee.user.role.charAt(0) + employee.user.role.slice(1).toLowerCase()}`,
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(employee)}
                      title={
                        employee.isActive ? tc("deactivate") : tc("activate")
                      }
                    >
                      <Badge
                        variant={employee.isActive ? "success" : "outline"}
                        className="cursor-pointer hover:opacity-80"
                      >
                        {employee.isActive ? tc("active") : tc("inactive")}
                      </Badge>
                    </button>
                  </div>

                  {/* ── Live clock-in status ── */}
                  {employee.isActive &&
                    (() => {
                      const ts = teamStatusMap[employee.id];
                      if (!ts || ts.status === "offline") return null;

                      const clockInTime = ts.active?.clockInAt
                        ? new Date(ts.active.clockInAt).toLocaleTimeString(
                            "de-DE",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : (ts.active?.startTime ?? "");

                      if (ts.status === "working") {
                        return (
                          <div className="mt-2 flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <ClockIcon className="h-3.5 w-3.5" />
                            {t("liveStatus.workingSince", {
                              time: clockInTime,
                            })}
                            {ts.active?.breakEnd && (
                              <span className="ml-1 text-gray-500 dark:text-gray-400">
                                · {t("liveStatus.breakDone")}
                              </span>
                            )}
                          </div>
                        );
                      }

                      if (ts.status === "break") {
                        return (
                          <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <span className="relative flex h-2 w-2">
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                            </span>
                            <ClockIcon className="h-3.5 w-3.5" />
                            {t("liveStatus.workingSince", {
                              time: clockInTime,
                            })}{" "}
                            · {t("liveStatus.onBreak")}
                          </div>
                        );
                      }

                      return null;
                    })()}

                  <div className="mt-4 space-y-2">
                    {employee.email ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 min-w-0">
                        <MailIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 min-w-0">
                        <AlertCircleIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{t("missingEmail")}</span>
                      </div>
                    )}
                    {employee.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 min-w-0">
                        <PhoneIcon className="h-4 w-4 flex-shrink-0" />
                        {employee.phone}
                      </div>
                    )}
                    {employee.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 min-w-0">
                        <MapPinIcon className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">
                          {employee.location.name}
                        </span>
                      </div>
                    )}
                    {employee.departments &&
                      employee.departments.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 min-w-0">
                          <BuildingIcon className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="truncate">
                            {employee.departments
                              .map((d) => d.department.name)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    {employee.hourlyRate && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <BriefcaseIcon className="h-4 w-4" />
                        {fmtNum(employee.hourlyRate)} €/h
                        {employee.weeklyHours &&
                          ` · ${employee.weeklyHours}${tc("hrsPerWeek")}`}
                      </div>
                    )}
                    {employee.employeeSkills &&
                      employee.employeeSkills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <AwardIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          {employee.employeeSkills.map((es) => (
                            <Badge
                              key={es.id}
                              className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs border-emerald-200 dark:border-emerald-800"
                            >
                              {es.skill.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* ── PIN status + Send PIN ── */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge
                      variant={employee.pinHash ? "success" : "outline"}
                      className="text-xs"
                    >
                      {employee.pinHash ? tq("pinAssigned") : tq("noPin")}
                    </Badge>
                    {employee.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          pinSendingId === employee.id ||
                          pinSentId === employee.id
                        }
                        onClick={async () => {
                          setPinSendingId(employee.id);
                          try {
                            const res = await fetch(
                              `/api/employees/${employee.id}/resend-pin`,
                              { method: "POST" },
                            );
                            if (res.status === 429) {
                              alert(tq("emailLimitReached"));
                            } else {
                              setPinSentId(employee.id);
                              setTimeout(
                                () =>
                                  setPinSentId((id) =>
                                    id === employee.id ? null : id,
                                  ),
                                4000,
                              );
                            }
                          } finally {
                            setPinSendingId(null);
                          }
                        }}
                        className="text-xs h-7 px-2.5"
                      >
                        {pinSentId === employee.id
                          ? tq("pinSent") + " ✓"
                          : pinSendingId === employee.id
                            ? "..."
                            : tq("sendPin")}
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/mitarbeiter/${employee.id}`)}
                    >
                      {t("view")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditForm(employee)}
                    >
                      <EditIcon className="h-4 w-4" />
                      {tc("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                      onClick={() => setDeleteTarget(employee.id)}
                    >
                      {tc("delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Discard Changes Confirmation Dialog */}
      <ConfirmDialog
        open={showDiscardConfirm}
        title={t("form.discardTitle")}
        message={t("form.discardMessage")}
        confirmLabel={t("form.discardConfirm")}
        cancelLabel={tc("cancel")}
        variant="warning"
        onConfirm={handleDiscardAndClose}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}
