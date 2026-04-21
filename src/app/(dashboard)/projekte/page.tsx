"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import { parseDecimalInput } from "@/lib/utils";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  UsersIcon,
  SearchIcon,
} from "@/components/icons";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";

interface Client {
  id: string;
  name: string;
}

interface ProjectMember {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  client?: Client | null;
  members: ProjectMember[];
  _count: { timeEntries: number };
  budgetMinutes?: number | null;
  costRate?: number | null;
  billRate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  totalMinutesLogged?: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

const INITIAL_FORM = {
  name: "",
  description: "",
  clientId: "",
  costRate: "",
  billRate: "",
  budgetMinutes: "",
  startDate: "",
  endDate: "",
  status: "AKTIV",
};

export default function ProjekteSeite() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const { handlePlanLimit } = usePlanLimit();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Member management
  const [memberProject, setMemberProject] = useState<Project | null>(null);
  const [memberEmployeeId, setMemberEmployeeId] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [pRes, cRes, eRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/clients"),
        fetch("/api/employees"),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        setProjects(d.data ?? d);
      } else setError(tc("errorLoading"));
      if (cRes.ok) {
        const d = await cRes.json();
        setClients(d.data ?? d);
      }
      if (eRes.ok) {
        const d = await eRes.json();
        setEmployees(d.data ?? (Array.isArray(d) ? d : []));
      }
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateForm() {
    setEditingProject(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(project: Project) {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || "",
      clientId: project.client?.id || "",
      costRate: project.costRate?.toString() || "",
      billRate: project.billRate?.toString() || "",
      budgetMinutes: project.budgetMinutes?.toString() || "",
      startDate: project.startDate ? project.startDate.split("T")[0] : "",
      endDate: project.endDate ? project.endDate.split("T")[0] : "",
      status: project.status,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const url = editingProject
        ? `/api/projects/${editingProject.id}`
        : "/api/projects";
      const method = editingProject ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          costRate: formData.costRate
            ? parseDecimalInput(formData.costRate)
            : null,
          billRate: formData.billRate
            ? parseDecimalInput(formData.billRate)
            : null,
          budgetMinutes: formData.budgetMinutes
            ? parseInt(formData.budgetMinutes)
            : null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setEditingProject(null);
        setFormData(INITIAL_FORM);
        fetchData();
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;
        const data = await res.json();
        setFormError(data.error || tc("errorOccurred"));
      }
    } catch {
      setFormError(tc("errorOccurred"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/projects/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchData();
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  async function addMember() {
    if (!memberProject || !memberEmployeeId) return;
    try {
      const res = await fetch(`/api/projects/${memberProject.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: memberEmployeeId }),
      });
      if (res.ok) {
        setMemberEmployeeId("");
        fetchData();
        // Refresh the memberProject from updated list
        const updated = await res.json();
        if (updated) {
          const refreshed = await fetch(`/api/projects`);
          if (refreshed.ok) {
            const all = await refreshed.json();
            setProjects(all);
            setMemberProject(
              all.find((p: Project) => p.id === memberProject.id) || null,
            );
          }
        }
      }
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  async function removeMember(memberId: string) {
    if (!memberProject) return;
    try {
      await fetch(`/api/projects/${memberProject.id}/members/${memberId}`, {
        method: "DELETE",
      });
      fetchData();
      const refreshed = await fetch("/api/projects");
      if (refreshed.ok) {
        const json = await refreshed.json();
        const all = json.data ?? json;
        setProjects(all);
        setMemberProject(
          all.find((p: Project) => p.id === memberProject.id) || null,
        );
      }
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  const statusConfig: Record<string, { color: string; label: string }> = {
    AKTIV: { color: "bg-green-100 text-green-800", label: t("active") },
    PAUSIERT: { color: "bg-yellow-100 text-yellow-800", label: t("paused") },
    ABGESCHLOSSEN: {
      color: "bg-emerald-100 text-emerald-800",
      label: t("completed"),
    },
    ARCHIVIERT: {
      color: "bg-gray-100 dark:bg-zinc-800 text-gray-800",
      label: t("archived"),
    },
  };

  const filteredProjects = projects.filter((p) =>
    `${p.name} ${p.client?.name || ""} ${p.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function formatBudgetProgress(project: Project): {
    percent: number;
    label: string;
  } {
    if (!project.budgetMinutes) return { percent: 0, label: "" };
    const logged = project.totalMinutesLogged || 0;
    const percent = Math.min(100, (logged / project.budgetMinutes) * 100);
    const loggedH = Math.floor(logged / 60);
    const budgetH = Math.floor(project.budgetMinutes / 60);
    return {
      percent,
      label: `${loggedH}h / ${budgetH}h`,
    };
  }

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={openCreateForm}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newProject")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />
      <PageContent>
        {/* Search */}
        {projects.length > 0 && (
          <div className="relative max-w-full sm:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 sm:left-3 sm:h-4 sm:w-4" />
            <Input
              placeholder={tc("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-11 sm:ps-10"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Create/Edit Form Modal */}
        <AdaptiveModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editingProject ? t("editProject") : t("newProject")}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("name")} *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("client")}</Label>
                <Select
                  value={formData.clientId}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      clientId: e.target.value,
                    }))
                  }
                >
                  <option value="">— {t("noClient")} —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              {editingProject && (
                <div className="space-y-2">
                  <Label>{t("status")}</Label>
                  <Select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        status: e.target.value,
                      }))
                    }
                  >
                    <option value="AKTIV">{t("active")}</option>
                    <option value="PAUSIERT">{t("paused")}</option>
                    <option value="ABGESCHLOSSEN">{t("completed")}</option>
                    <option value="ARCHIVIERT">{t("archived")}</option>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("costRate")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costRate}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      costRate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("billRate")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.billRate}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      billRate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("budgetHours")}</Label>
              <Input
                type="number"
                value={
                  formData.budgetMinutes
                    ? String(Math.round(parseInt(formData.budgetMinutes) / 60))
                    : ""
                }
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    budgetMinutes: e.target.value
                      ? String(parseInt(e.target.value) * 60)
                      : "",
                  }))
                }
                placeholder="z. B. 100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("startDate")}</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("endDate")}</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      endDate: e.target.value,
                    }))
                  }
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
                onClick={() => setShowForm(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "..." : editingProject ? tc("save") : t("newProject")}
              </Button>
            </ModalFooter>
          </form>
        </AdaptiveModal>

        {/* Member Management Modal */}
        <AdaptiveModal
          open={!!memberProject}
          onClose={() => setMemberProject(null)}
          title={memberProject ? `${t("members")} — ${memberProject.name}` : ""}
          size="md"
        >
          {memberProject && (
            <div className="space-y-4">
              {/* Add member */}
              <div className="flex gap-2">
                <Select
                  value={memberEmployeeId}
                  onChange={(e) => setMemberEmployeeId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">{tc("selectPlaceholder")}</option>
                  {employees
                    .filter(
                      (emp) =>
                        !memberProject.members.some(
                          (m) => m.employee.id === emp.id,
                        ),
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                </Select>
                <Button
                  onClick={addMember}
                  disabled={!memberEmployeeId}
                  size="sm"
                >
                  {tc("add")}
                </Button>
              </div>

              {/* Current members */}
              {memberProject.members.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {t("noMembers")}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {memberProject.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm text-gray-900">
                        {m.employee.firstName} {m.employee.lastName}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => removeMember(m.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </AdaptiveModal>

        {/* Project list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-12">
              <p className="text-lg font-medium text-gray-900">
                {search ? tc("noResults") : t("noProjects")}
              </p>
              {!search && (
                <Button className="mt-4" onClick={openCreateForm}>
                  <PlusIcon className="h-4 w-4" />
                  {t("newProject")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const sc = statusConfig[project.status] || {
                color: "bg-gray-100 dark:bg-zinc-800 text-gray-800",
                label: project.status,
              };
              const budget = formatBudgetProgress(project);

              return (
                <Card key={project.id} className="card-elevated">
                  <CardContent className="p-5 sm:p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-zinc-100 truncate pr-2">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge className={sc.color}>{sc.label}</Badge>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2 line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    {project.client && (
                      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
                        {t("client")}: {project.client.name}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400 mb-3">
                      <span>
                        {t("members")}: {project.members.length}
                      </span>
                    </div>

                    {budget.label && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                          <span>{t("budget")}</span>
                          <span>{budget.label}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800">
                          <div
                            className={`h-2 rounded-full ${budget.percent > 90 ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${budget.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-zinc-800">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditForm(project)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMemberProject(project)}
                      >
                        <UsersIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                        onClick={() => setDeleteTarget(project.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>

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
