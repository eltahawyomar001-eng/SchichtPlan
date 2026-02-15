"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PlusIcon,
  SearchIcon,
  XIcon,
  MailIcon,
  PhoneIcon,
  BriefcaseIcon,
  UsersIcon,
  EditIcon,
} from "@/components/icons";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  hourlyRate: number | null;
  weeklyHours: number | null;
  color: string | null;
  isActive: boolean;
}

export default function MitarbeiterPage() {
  const t = useTranslations("employeesPage");
  const tc = useTranslations("common");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
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
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      hourlyRate: "",
      weeklyHours: "",
    });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email || "",
      phone: emp.phone || "",
      position: emp.position || "",
      hourlyRate: emp.hourlyRate?.toString() || "",
      weeklyHours: emp.weeklyHours?.toString() || "",
    });
    setFormError(null);
    setShowForm(true);
  };

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
        });
        fetchEmployees();
      } else {
        const data = await res.json();
        setFormError(data.error || t("saveError"));
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
    } catch (error) {
      console.error("Error:", error);
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
    } catch (error) {
      console.error("Error:", error);
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

      <div className="p-4 sm:p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-full sm:max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Add/Edit Employee Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {editingEmployee ? t("form.editTitle") : t("form.title")}
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
                      <Label htmlFor="weeklyHours">
                        {t("form.weeklyHours")}
                      </Label>
                      <Input
                        id="weeklyHours"
                        type="number"
                        step="0.5"
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

                  {formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {formError}
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
                      {editingEmployee ? tc("save") : t("addEmployee")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employee List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">{tc("loading")}</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <UsersIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900">
                {search ? t("noSearchResults") : t("noEmployees")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {search ? t("noSearchResultsHint") : t("noEmployeesHint")}
              </p>
              {!search && (
                <Button className="mt-4" onClick={openCreateForm}>
                  <PlusIcon className="h-4 w-4" />
                  {t("addEmployee")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className={`hover:shadow-md transition-shadow ${!employee.isActive ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${employee.firstName} ${employee.lastName}`}
                        color={employee.color || "#3B82F6"}
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        {employee.position && (
                          <p className="text-sm text-gray-500">
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
                    {employee.hourlyRate && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BriefcaseIcon className="h-4 w-4" />
                        {employee.hourlyRate.toFixed(2)} €/h
                        {employee.weeklyHours &&
                          ` · ${employee.weeklyHours}${tc("hrsPerWeek")}`}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
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
      </div>

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
    </div>
  );
}
