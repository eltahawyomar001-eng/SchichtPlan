"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PlusIcon } from "@/components/icons";

// ─── Types ──────────────────────────────────────────────────────
interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ActionItem {
  type: string;
  message?: string;
  to?: string;
  percent?: number;
}

interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  conditions: Condition[];
  actions: ActionItem[];
  isActive: boolean;
  lastTriggered?: string | null;
}

// ─── Constants ──────────────────────────────────────────────────
const TRIGGER_OPTIONS = [
  "shift.created",
  "shift.updated",
  "shift.deleted",
  "time-entry.created",
  "time-entry.submitted",
  "absence.created",
  "absence.approved",
  "employee.created",
] as const;

const OPERATOR_OPTIONS = [
  "equals",
  "not_equals",
  "contains",
  "gt",
  "lt",
  "gte",
  "lte",
] as const;

const ACTION_TYPES = [
  "send_notification",
  "send_email",
  "apply_surcharge",
] as const;

const TRIGGER_FIELDS: Record<string, string[]> = {
  "shift.created": [
    "employeeId",
    "date",
    "startTime",
    "endTime",
    "status",
    "isNightShift",
    "isSundayShift",
    "isHolidayShift",
    "surchargePercent",
  ],
  "shift.updated": ["employeeId", "date", "startTime", "endTime", "status"],
  "shift.deleted": ["id"],
  "time-entry.created": ["employeeId", "date", "startTime"],
  "time-entry.submitted": [
    "employeeId",
    "date",
    "startTime",
    "endTime",
    "grossMinutes",
    "netMinutes",
    "breakMinutes",
  ],
  "absence.created": [
    "employeeId",
    "category",
    "startDate",
    "endDate",
    "totalDays",
    "halfDayStart",
    "halfDayEnd",
    "autoApproved",
  ],
  "absence.approved": [
    "employeeId",
    "category",
    "startDate",
    "endDate",
    "totalDays",
  ],
  "employee.created": ["firstName", "lastName", "email", "position"],
};

// ─── Page Component ─────────────────────────────────────────────
export default function AutomatisierungSeite() {
  const t = useTranslations("automationRules");
  const locale = useLocale();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState<string>(TRIGGER_OPTIONS[0]);
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formActions, setFormActions] = useState<ActionItem[]>([]);

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

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormTrigger(TRIGGER_OPTIONS[0]);
    setFormConditions([]);
    setFormActions([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/automation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription || undefined,
          trigger: formTrigger,
          conditions: formConditions,
          actions: formActions,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        resetForm();
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
    if (!confirm(t("deleteConfirm"))) return;
    await fetch(`/api/automation-rules/${id}`, { method: "DELETE" });
    fetchRules();
  }

  // ── Condition helpers ──
  function addCondition() {
    const fields = TRIGGER_FIELDS[formTrigger] || [];
    setFormConditions([
      ...formConditions,
      { field: fields[0] || "", operator: "equals", value: "" },
    ]);
  }

  function updateCondition(idx: number, patch: Partial<Condition>) {
    setFormConditions(
      formConditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  }

  function removeCondition(idx: number) {
    setFormConditions(formConditions.filter((_, i) => i !== idx));
  }

  // ── Action helpers ──
  function addAction() {
    setFormActions([
      ...formActions,
      { type: "send_notification", message: "" },
    ]);
  }

  function updateAction(idx: number, patch: Partial<ActionItem>) {
    setFormActions(
      formActions.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    );
  }

  function removeAction(idx: number) {
    setFormActions(formActions.filter((_, i) => i !== idx));
  }

  // ── Available fields for current trigger ──
  const availableFields = TRIGGER_FIELDS[formTrigger] || [];

  // When trigger changes, reset conditions (fields may differ)
  function handleTriggerChange(newTrigger: string) {
    setFormTrigger(newTrigger);
    setFormConditions([]);
  }

  // ── Formatting helpers ──
  function formatTrigger(trigger: string): string {
    return t(`triggerLabels.${trigger}` as Parameters<typeof t>[0]);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("newRule")}
          </button>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {/* ── Create Form ── */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5"
          >
            {/* Name + Trigger */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("name")} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z.B. Nachtschicht-Benachrichtigung"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("trigger")} *
                </label>
                <select
                  value={formTrigger}
                  onChange={(e) => handleTriggerChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatTrigger(opt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("descriptionLabel")}{" "}
                <span className="text-gray-400 font-normal">
                  ({t("optional")})
                </span>
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="z.B. Benachrichtigung bei Nachtschichten"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* ── Conditions ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t("conditions")}{" "}
                  <span className="text-gray-400 font-normal">
                    ({t("optional")})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={addCondition}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  {t("addCondition")}
                </button>
              </div>
              {formConditions.length === 0 && (
                <p className="text-xs text-gray-400 py-2">
                  Ohne Bedingungen wird die Regel bei jedem Auslöser ausgeführt.
                </p>
              )}
              <div className="space-y-2">
                {formConditions.map((cond, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <select
                      value={cond.field}
                      onChange={(e) =>
                        updateCondition(idx, { field: e.target.value })
                      }
                      className="flex-1 min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {availableFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={(e) =>
                        updateCondition(idx, { operator: e.target.value })
                      }
                      className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <option key={op} value={op}>
                          {t(`operatorLabels.${op}` as Parameters<typeof t>[0])}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) =>
                        updateCondition(idx, { value: e.target.value })
                      }
                      placeholder={t("value")}
                      className="flex-1 min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1"
                      aria-label={t("remove")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Actions ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t("actions")} *
                </label>
                <button
                  type="button"
                  onClick={addAction}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  {t("addAction")}
                </button>
              </div>
              {formActions.length === 0 && (
                <p className="text-xs text-red-400 py-2">
                  Mindestens eine Aktion ist erforderlich.
                </p>
              )}
              <div className="space-y-3">
                {formActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <select
                        value={action.type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const base: ActionItem = { type: newType };
                          if (
                            newType === "send_notification" ||
                            newType === "send_email"
                          )
                            base.message = "";
                          if (newType === "send_email") base.to = "";
                          if (newType === "apply_surcharge") base.percent = 0;
                          updateAction(idx, base);
                        }}
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {ACTION_TYPES.map((at) => (
                          <option key={at} value={at}>
                            {t(
                              `actionTypeLabels.${at}` as Parameters<
                                typeof t
                              >[0],
                            )}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1"
                        aria-label={t("remove")}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Action-specific fields */}
                    {(action.type === "send_notification" ||
                      action.type === "send_email") && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {t("message")}
                        </label>
                        <input
                          type="text"
                          value={action.message || ""}
                          onChange={(e) =>
                            updateAction(idx, { message: e.target.value })
                          }
                          placeholder="z.B. Neue Schicht am {{date}} um {{startTime}}"
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {
                            "Platzhalter: {{feld}} — z.B. {{date}}, {{employeeId}}, {{startTime}}"
                          }
                        </p>
                      </div>
                    )}

                    {action.type === "send_email" && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {t("recipientEmail")}
                        </label>
                        <input
                          type="email"
                          value={action.to || ""}
                          onChange={(e) =>
                            updateAction(idx, { to: e.target.value })
                          }
                          placeholder="empfaenger@firma.de"
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {action.type === "apply_surcharge" && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {t("surchargePercent")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={action.percent ?? 0}
                          onChange={(e) =>
                            updateAction(idx, {
                              percent: Number(e.target.value),
                            })
                          }
                          className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || formActions.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "..." : t("save")}
              </button>
            </div>
          </form>
        )}

        {/* ── Rules List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-medium text-gray-900">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-sm text-gray-500">
                        {rule.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {formatTrigger(rule.trigger)}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {t("conditionsCount", {
                          count: rule.conditions?.length || 0,
                        })}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {t("actionsCount", {
                          count: rule.actions?.length || 0,
                        })}
                      </span>
                    </div>
                    {rule.lastTriggered && (
                      <p className="text-xs text-gray-400 pt-1">
                        {t("lastTriggered")}: {formatDate(rule.lastTriggered)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        rule.isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {rule.isActive ? t("active") : t("inactive")}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label={t("remove")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
