"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageContent } from "@/components/ui/page-content";
import {
  PlusIcon,
  BellIcon,
  MailIcon,
  CreditCardIcon,
} from "@/components/icons";

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
  const tc = useTranslations("common");
  const locale = useLocale();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState<string>(TRIGGER_OPTIONS[0]);
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formActions, setFormActions] = useState<ActionItem[]>([]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/automation-rules");
      if (res.ok) {
        const d = await res.json();
        setRules(d.data ?? d);
      }
    } catch {
      setLoadError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else {
        const data = await res.json();
        setLoadError(data.error || tc("errorOccurred"));
      }
    } catch {
      setLoadError(tc("errorOccurred"));
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

  async function deleteRule() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/automation-rules/${deleteTarget}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      fetchRules();
    } catch {
      setLoadError(tc("errorOccurred"));
      setDeleteTarget(null);
    }
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
    // Replace dots with underscores to match translation keys (next-intl uses dots for nesting)
    const key = trigger.replace(/\./g, "_");
    return t(`triggerLabels.${key}` as Parameters<typeof t>[0]);
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
          <Button onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            {t("newRule")}
          </Button>
        }
      />
      <PageContent>
        {/* Error */}
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-800 dark:text-red-400">
            {loadError}
          </div>
        )}

        {/* ── Create Form ── */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{t("newRule")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-5">
                {/* Name + Trigger */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ruleName">{t("name")} *</Label>
                    <Input
                      id="ruleName"
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="z.B. Nachtschicht-Benachrichtigung"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ruleTrigger">{t("trigger")} *</Label>
                    <Select
                      id="ruleTrigger"
                      value={formTrigger}
                      onChange={(e) => handleTriggerChange(e.target.value)}
                    >
                      {TRIGGER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {formatTrigger(opt)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="ruleDesc">
                    {t("descriptionLabel")}{" "}
                    <span className="text-gray-400 font-normal">
                      ({t("optional")})
                    </span>
                  </Label>
                  <Input
                    id="ruleDesc"
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="z.B. Benachrichtigung bei Nachtschichten"
                  />
                </div>

                {/* ── Conditions ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>
                      {t("conditions")}{" "}
                      <span className="text-gray-400 font-normal">
                        ({t("optional")})
                      </span>
                    </Label>
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
                    <p className="text-xs text-gray-400 dark:text-zinc-500 py-2">
                      Ohne Bedingungen wird die Regel bei jedem Auslöser
                      ausgeführt.
                    </p>
                  )}
                  <div className="space-y-2">
                    {formConditions.map((cond, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 dark:bg-zinc-800 p-3"
                      >
                        <Select
                          value={cond.field}
                          onChange={(e) =>
                            updateCondition(idx, { field: e.target.value })
                          }
                          className="flex-1 min-w-0"
                        >
                          {availableFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </Select>
                        <Select
                          value={cond.operator}
                          onChange={(e) =>
                            updateCondition(idx, { operator: e.target.value })
                          }
                          className="w-40"
                        >
                          {OPERATOR_OPTIONS.map((op) => (
                            <option key={op} value={op}>
                              {t(
                                `operatorLabels.${op}` as Parameters<
                                  typeof t
                                >[0],
                              )}
                            </option>
                          ))}
                        </Select>
                        <Input
                          value={cond.value}
                          onChange={(e) =>
                            updateCondition(idx, { value: e.target.value })
                          }
                          placeholder={t("value")}
                          className="flex-1 min-w-0"
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
                    <Label>{t("actions")} *</Label>
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
                        className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 dark:bg-zinc-800 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Select
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
                              if (newType === "apply_surcharge")
                                base.percent = 0;
                              updateAction(idx, base);
                            }}
                            className="flex-1"
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
                          </Select>
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
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {t("message")}
                            </Label>
                            <Input
                              value={action.message || ""}
                              onChange={(e) =>
                                updateAction(idx, { message: e.target.value })
                              }
                              placeholder="z.B. Neue Schicht am {{date}} um {{startTime}}"
                            />
                            <p className="text-xs text-gray-400">
                              {
                                "Platzhalter: {{feld}} — z.B. {{date}}, {{employeeId}}, {{startTime}}"
                              }
                            </p>
                          </div>
                        )}

                        {action.type === "send_email" && (
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {t("recipientEmail")}
                            </Label>
                            <Input
                              type="email"
                              value={action.to || ""}
                              onChange={(e) =>
                                updateAction(idx, { to: e.target.value })
                              }
                              placeholder="empfaenger@firma.de"
                            />
                          </div>
                        )}

                        {action.type === "apply_surcharge" && (
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {t("surchargePercent")}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={String(action.percent ?? 0)}
                              onChange={(e) =>
                                updateAction(idx, {
                                  percent: Number(e.target.value),
                                })
                              }
                              className="w-32"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || formActions.length === 0}
                  >
                    {saving ? "..." : t("save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Rules List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50/50 dark:bg-zinc-900/50 p-8 sm:p-12">
            <div className="mx-auto max-w-lg text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50">
                <svg
                  className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                  {t("noRules")}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                  {t("emptyDescription")}
                </p>
              </div>

              {/* Example templates */}
              <div className="text-left space-y-2 pt-2">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                  {t("exampleTemplatesTitle")}
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      icon: <BellIcon className="h-4 w-4" />,
                      label: t("exampleNotifyNightShift"),
                    },
                    {
                      icon: <MailIcon className="h-4 w-4" />,
                      label: t("exampleEmailAbsence"),
                    },
                    {
                      icon: <CreditCardIcon className="h-4 w-4" />,
                      label: t("exampleSurchargeSunday"),
                    },
                  ].map((ex, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm text-gray-600 dark:text-zinc-300"
                    >
                      <span className="flex-shrink-0 mt-0.5">{ex.icon}</span>
                      <span>{ex.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => setShowForm(true)} className="mt-4">
                <PlusIcon className="h-4 w-4" />
                {t("newRule")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-medium text-gray-900 dark:text-zinc-100">
                      {rule.name}
                    </h3>
                    {rule.description && (
                      <p className="text-sm text-gray-500 dark:text-zinc-400">
                        {rule.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                        {formatTrigger(rule.trigger)}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-gray-600 dark:text-zinc-400">
                        {t("conditionsCount", {
                          count: rule.conditions?.length || 0,
                        })}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-gray-600 dark:text-zinc-400">
                        {t("actionsCount", {
                          count: rule.actions?.length || 0,
                        })}
                      </span>
                    </div>
                    {rule.lastTriggered && (
                      <p className="text-xs text-gray-400 dark:text-zinc-500 pt-1">
                        {t("lastTriggered")}: {formatDate(rule.lastTriggered)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        rule.isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {rule.isActive ? t("active") : t("inactive")}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(rule.id)}
                      className="rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-950/50 transition-colors"
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
      </PageContent>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={deleteRule}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
