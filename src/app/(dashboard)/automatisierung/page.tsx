"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PlusIcon } from "@/components/icons";

interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  conditions: unknown[];
  actions: unknown[];
  isActive: boolean;
  lastTriggered?: string | null;
}

export default function AutomatisierungSeite() {
  const t = useTranslations("automationRules");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger: "shift.created",
    conditions: "[]",
    actions: "[]",
  });
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/automation-rules");
      if (res.ok) setRules(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/automation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          trigger: formData.trigger,
          conditions: JSON.parse(formData.conditions || "[]"),
          actions: JSON.parse(formData.actions || "[]"),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          name: "",
          description: "",
          trigger: "shift.created",
          conditions: "[]",
          actions: "[]",
        });
        fetchRules();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: AutomationRule) {
    await fetch(`/api/automation-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchRules();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/automation-rules/${id}`, { method: "DELETE" });
    fetchRules();
  }

  const triggerOptions = [
    "shift.created",
    "shift.updated",
    "shift.deleted",
    "time-entry.created",
    "time-entry.submitted",
    "absence.created",
    "absence.approved",
    "employee.created",
  ];

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
            {t("newRule")}
          </button>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
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
                  {t("trigger")} *
                </label>
                <select
                  value={formData.trigger}
                  onChange={(e) =>
                    setFormData({ ...formData, trigger: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {triggerOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("actions")} (JSON)
              </label>
              <textarea
                value={formData.actions}
                onChange={(e) =>
                  setFormData({ ...formData, actions: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? "..." : t("newRule")}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">{t("noRules")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {rule.name}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {t("trigger")}: {rule.trigger}
                  </p>
                  {rule.description && (
                    <p className="text-sm text-gray-400 truncate">
                      {rule.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(rule)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      rule.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {rule.isActive ? t("active") : t("inactive")}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
