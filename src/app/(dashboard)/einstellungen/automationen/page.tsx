"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ClockIcon,
  CircleCheckIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  RefreshIcon,
  BellIcon,
  ScaleIcon,
  LockIcon,
  ZapIcon,
  ChevronLeftIcon,
} from "@/components/icons";
import type { SVGProps, ComponentType } from "react";

/** Automation key → category mapping */
type AutomationCategory =
  | "shiftManagement"
  | "timeTracking"
  | "approvals"
  | "alertsCompliance";

interface AutomationRule {
  key: string;
  category: AutomationCategory;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconColor: string;
}

const AUTOMATION_RULES: AutomationRule[] = [
  // ── Shift Management ──
  {
    key: "shiftConflictDetection",
    category: "shiftManagement",
    icon: AlertTriangleIcon,
    iconColor: "text-amber-500",
  },
  {
    key: "restPeriodEnforcement",
    category: "shiftManagement",
    icon: ShieldCheckIcon,
    iconColor: "text-blue-600",
  },
  {
    key: "cascadeAbsenceCancellation",
    category: "shiftManagement",
    icon: CalendarIcon,
    iconColor: "text-red-500",
  },
  {
    key: "recurringShifts",
    category: "shiftManagement",
    icon: RefreshIcon,
    iconColor: "text-violet-500",
  },

  // ── Time Tracking ──
  {
    key: "autoCreateTimeEntries",
    category: "timeTracking",
    icon: ClockIcon,
    iconColor: "text-blue-500",
  },
  {
    key: "legalBreakEnforcement",
    category: "timeTracking",
    icon: ShieldCheckIcon,
    iconColor: "text-emerald-600",
  },
  {
    key: "timeAccountRecalculation",
    category: "timeTracking",
    icon: ScaleIcon,
    iconColor: "text-violet-600",
  },

  // ── Approvals ──
  {
    key: "autoApproveAbsence",
    category: "approvals",
    icon: CircleCheckIcon,
    iconColor: "text-emerald-500",
  },
  {
    key: "autoApproveSwap",
    category: "approvals",
    icon: CircleCheckIcon,
    iconColor: "text-blue-500",
  },

  // ── Alerts & Compliance ──
  {
    key: "overtimeAlerts",
    category: "alertsCompliance",
    icon: AlertCircleIcon,
    iconColor: "text-red-600",
  },
  {
    key: "payrollAutoLock",
    category: "alertsCompliance",
    icon: LockIcon,
    iconColor: "text-amber-600",
  },
  {
    key: "notifications",
    category: "alertsCompliance",
    icon: BellIcon,
    iconColor: "text-blue-500",
  },
];

const CATEGORIES: AutomationCategory[] = [
  "shiftManagement",
  "timeTracking",
  "approvals",
  "alertsCompliance",
];

const categoryIcons: Record<
  AutomationCategory,
  { icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }
> = {
  shiftManagement: { icon: CalendarIcon, color: "text-blue-600 bg-blue-50" },
  timeTracking: { icon: ClockIcon, color: "text-violet-600 bg-violet-50" },
  approvals: {
    icon: CircleCheckIcon,
    color: "text-emerald-600 bg-emerald-50",
  },
  alertsCompliance: {
    icon: AlertCircleIcon,
    color: "text-red-600 bg-red-50",
  },
};

export default function AutomationenPage() {
  const t = useTranslations("automations");
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // key being saved
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/automations/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to fetch automation settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function toggleSetting(key: string) {
    const newValue = !settings[key];
    const prev = { ...settings };

    // Optimistic update
    setSettings((s) => ({ ...s, [key]: newValue }));
    setSaving(key);
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/automations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [key]: newValue } }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        setSettings(prev);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch {
      setSettings(prev);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } finally {
      setSaving(null);
    }
  }

  async function bulkToggle(enabled: boolean) {
    const prev = { ...settings };
    const newSettings: Record<string, boolean> = {};
    for (const rule of AUTOMATION_RULES) {
      newSettings[rule.key] = enabled;
    }

    setSettings((s) => ({ ...s, ...newSettings }));
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/automations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        setSettings(prev);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch {
      setSettings(prev);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }

  const enabledCount = Object.values(settings).filter(Boolean).length;
  const totalCount = AUTOMATION_RULES.length;

  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
        {/* Back link + status bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link
            href="/einstellungen"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            {t("backToSettings")}
          </Link>

          <div className="flex items-center gap-3">
            {/* Save status indicator */}
            {saveStatus !== "idle" && (
              <span
                className={`text-xs font-medium ${
                  saveStatus === "saving"
                    ? "text-gray-400"
                    : saveStatus === "saved"
                      ? "text-emerald-600"
                      : "text-red-500"
                }`}
              >
                {saveStatus === "saving"
                  ? t("saving")
                  : saveStatus === "saved"
                    ? t("saved")
                    : t("error")}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkToggle(true)}
            >
              {t("enableAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkToggle(false)}
            >
              {t("disableAll")}
            </Button>
          </div>
        </div>

        {/* Summary banner */}
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 px-4 py-3">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <ZapIcon className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {enabledCount}/{totalCount}{" "}
              {enabledCount === 1 ? "Automation" : t("title").toLowerCase()}{" "}
              {t("enabled").toLowerCase()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t("subtitle")}</p>
          </div>
        </div>

        {/* Categories */}
        {CATEGORIES.map((cat) => {
          const rules = AUTOMATION_RULES.filter((r) => r.category === cat);
          const CatIcon = categoryIcons[cat].icon;
          const catColor = categoryIcons[cat].color;

          return (
            <Card key={cat}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${catColor.split(" ")[1] || ""}`}
                  >
                    <CatIcon
                      className={`h-5 w-5 ${catColor.split(" ")[0] || ""}`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t(`categories.${cat}`)}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {t(`categories.${cat}Desc`)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100">
                  {rules.map((rule) => {
                    const Icon = rule.icon;
                    const isEnabled = settings[rule.key] ?? true;
                    const isSaving = saving === rule.key;

                    return (
                      <div
                        key={rule.key}
                        className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <Icon className={`h-5 w-5 ${rule.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {t(`rules.${rule.key}.name`)}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isEnabled
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {isEnabled ? t("enabled") : t("disabled")}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {t(`rules.${rule.key}.desc`)}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleSetting(rule.key)}
                          disabled={isSaving}
                          className={`relative flex-shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 ${
                            isEnabled ? "bg-violet-600" : "bg-gray-200"
                          }`}
                          role="switch"
                          aria-checked={isEnabled}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              isEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
