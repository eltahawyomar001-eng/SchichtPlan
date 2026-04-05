"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "@/components/icons";

interface EmployeeSkill {
  id: string;
  skill: { id: string; name: string };
}

interface LocationItem {
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
  color: string | null;
  isActive: boolean;
  employeeSkills?: EmployeeSkill[];
  locationId?: string | null;
  location?: LocationItem | null;
}

export default function MitarbeiterPage() {
  const t = useTranslations("employeesPage");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handlePlanLimit } = usePlanLimit();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
    color: "#10b981",
    locationId: "",
  });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialFormDataRef = useRef(formData);

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
      setEmployees(data.data ?? data);
    } catch {
      setError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, [fetchEmployees, fetchLocations]);

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
      color: "#10b981",
      locationId: "",
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
      color: emp.color || "#10b981",
      locationId: emp.locationId || "",
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
    setFormError(null);
    try {
      const url = editingEmployee
        ? `/api/employees/${editingEmployee.id}`
        : "/api/employees";
      const method = editingEmployee ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
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
          color: "#10b981",
          locationId: "",
        });
        fetchEmployees();
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
          setFormError(data.error || t("saveError"));
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setFormError(t("networkError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/employees/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchEmployees();
    } catch {
      setError(tc("errorOccurred"));
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...emp, isActive: !emp.isActive }),
      });
      fetchEmployees();
    } catch {
      setError(tc("errorOccurred"));
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName} ${emp.position || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={openCreateForm}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newEmployee")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <PageContent>
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-full sm:max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10"
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
              <Label htmlFor="email">{t("form.email")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
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
                  className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <span className="text-sm text-gray-500 font-mono">
                  {formData.color}
                </span>
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
              <Button type="submit">
                {editingEmployee ? tc("save") : t("addEmployee")}
              </Button>
            </ModalFooter>
          </form>
        </AdaptiveModal>

        {/* Employee List */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6"
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                        <p className="font-semibold text-gray-900 truncate">
                          {employee.firstName} {employee.lastName}
                        </p>
                        {employee.position && (
                          <p className="text-sm text-gray-500 truncate">
                            {employee.position}
                          </p>
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

                  <div className="mt-4 space-y-2">
                    {employee.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                        <MailIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    )}
                    {employee.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                        <PhoneIcon className="h-4 w-4 flex-shrink-0" />
                        {employee.phone}
                      </div>
                    )}
                    {employee.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                        <MapPinIcon className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span className="truncate">
                          {employee.location.name}
                        </span>
                      </div>
                    )}
                    {employee.hourlyRate && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BriefcaseIcon className="h-4 w-4" />
                        {employee.hourlyRate.toFixed(2)} €/h
                        {employee.weeklyHours &&
                          ` · ${employee.weeklyHours}${tc("hrsPerWeek")}`}
                      </div>
                    )}
                    {employee.employeeSkills &&
                      employee.employeeSkills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <AwardIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          {employee.employeeSkills.map((es) => (
                            <Badge
                              key={es.id}
                              className="bg-emerald-50 text-emerald-700 text-xs border-emerald-200"
                            >
                              {es.skill.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
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
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
