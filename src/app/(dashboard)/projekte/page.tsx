"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PlusIcon } from "@/components/icons";

interface Project {
  id: string;
  name: string;
  status: string;
  client?: { id: string; name: string } | null;
  members: { id: string; employee: { firstName: string; lastName: string } }[];
  _count: { timeEntries: number };
  budgetMinutes?: number | null;
  costRate?: number | null;
  billRate?: number | null;
}

export default function ProjekteSeite() {
  const t = useTranslations("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    clientId: "",
    costRate: "",
    billRate: "",
    budgetMinutes: "",
    startDate: "",
    endDate: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          name: "",
          description: "",
          clientId: "",
          costRate: "",
          billRate: "",
          budgetMinutes: "",
          startDate: "",
          endDate: "",
        });
        fetchProjects();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const statusColor: Record<string, string> = {
    AKTIV: "bg-green-100 text-green-800",
    PAUSIERT: "bg-yellow-100 text-yellow-800",
    ABGESCHLOSSEN: "bg-blue-100 text-blue-800",
    ARCHIVIERT: "bg-gray-100 text-gray-800",
  };

  const statusLabel: Record<string, string> = {
    AKTIV: t("active"),
    PAUSIERT: t("paused"),
    ABGESCHLOSSEN: t("completed"),
    ARCHIVIERT: t("archived"),
  };

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("newProject")}
          </button>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("name")} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("costRate")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.costRate}
                  onChange={(e) =>
                    setFormData({ ...formData, costRate: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("billRate")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.billRate}
                  onChange={(e) =>
                    setFormData({ ...formData, billRate: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("budgetMinutes")}
                </label>
                <input
                  type="number"
                  value={formData.budgetMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, budgetMinutes: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("endDate")}
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? "..." : t("newProject")}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">{t("noProjects")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {project.name}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[project.status] || "bg-gray-100 text-gray-800"}`}
                  >
                    {statusLabel[project.status] || project.status}
                  </span>
                </div>
                {project.client && (
                  <p className="text-sm text-gray-500 mb-2">
                    {t("client")}: {project.client.name}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    {t("members")}: {project.members.length}
                  </span>
                  <span>
                    {t("timeSpent")}: {project._count.timeEntries}
                  </span>
                </div>
                {project.budgetMinutes && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1">
                      {t("budget")}
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-violet-500"
                        style={{
                          width: `${Math.min(100, (project._count.timeEntries / project.budgetMinutes) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
