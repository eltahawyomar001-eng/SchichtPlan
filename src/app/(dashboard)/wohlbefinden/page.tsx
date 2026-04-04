"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Select } from "@/components/ui/select";
import {
  HeartPulseIcon,
  UsersIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  RefreshIcon,
} from "@/components/icons";

/* ─── Types ───────────────────────────────────────────────── */

interface RiskFactor {
  key: string;
  label: string;
  value: number;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
}

interface EmployeeWellness {
  employeeId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  departmentName: string | null;
  score: number;
  level: "excellent" | "good" | "caution" | "warning" | "critical";
  riskFactors: RiskFactor[];
  shiftsInPeriod: number;
  hoursInPeriod: number;
}

interface WellnessSummary {
  totalEmployees: number;
  averageScore: number;
  critical: number;
  warning: number;
  caution: number;
  good: number;
  excellent: number;
  period: { start: string; end: string; days: number };
}

interface WellnessData {
  summary: WellnessSummary;
  employees: EmployeeWellness[];
}

/* ─── Helpers ─────────────────────────────────────────────── */

const levelConfig = {
  excellent: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    barColor: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  good: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    barColor: "bg-blue-500",
    dot: "bg-blue-500",
  },
  caution: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    barColor: "bg-amber-500",
    dot: "bg-amber-500",
  },
  warning: {
    color: "text-orange-700",
    bg: "bg-orange-50",
    ring: "ring-orange-200",
    barColor: "bg-orange-500",
    dot: "bg-orange-500",
  },
  critical: {
    color: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
    barColor: "bg-red-500",
    dot: "bg-red-500",
  },
};

const severityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

/* ─── Component ───────────────────────────────────────────── */

export default function WohlbefindenSeite() {
  const t = useTranslations("wellness");

  const [data, setData] = useState<WellnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "atRisk">("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/wellness?days=${days}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEmployees =
    data?.employees.filter((e) => {
      if (filter === "atRisk")
        return ["critical", "warning", "caution"].includes(e.level);
      return true;
    }) ?? [];

  /* ─── Render ──────────────────────────────────────────── */

  const periodSelector = (
    <div className="flex items-center gap-2">
      <Select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="h-9 sm:h-9 text-xs"
      >
        <option value={7}>{t("last7")}</option>
        <option value={14}>{t("last14")}</option>
        <option value={30}>{t("last30")}</option>
      </Select>
      <button
        onClick={fetchData}
        disabled={loading}
        className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
        title={t("retry")}
      >
        <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  return (
    <>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={periodSelector}
        hideMobile
      />
      {/* iOS mobile header */}
      <div className="lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))] px-4 pb-2">
        <h1 className="text-[34px] font-bold tracking-tight text-gray-900 leading-[1.1]">
          {t("title")}
        </h1>
        <p className="text-[15px] text-gray-500 mt-1">{t("description")}</p>
        {/* Period selector inline on mobile */}
        <div className="mt-3">{periodSelector}</div>
      </div>

      <PageContent>
        {/* Loading */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-4">
              <div className="absolute -inset-2 animate-pulse rounded-full bg-emerald-100/60" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-white">
                <HeartPulseIcon className="h-8 w-8 animate-pulse text-emerald-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500">{t("loading")}</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangleIcon className="mb-3 h-10 w-10 text-red-400" />
            <p className="text-sm font-medium text-gray-700">{t("error")}</p>
            <button
              onClick={fetchData}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {/* Data loaded */}
        {data && !error && (
          <>
            {/* ── Legal Disclaimer ── */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-amber-900">
                    {t("disclaimerTitle")}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    {t("disclaimerText")}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {/* Average Score */}
              <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <HeartPulseIcon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("avgScore")}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {data.summary.averageScore}
                  <span className="text-sm font-normal text-gray-400">
                    /100
                  </span>
                </p>
              </div>

              {/* Employees */}
              <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <UsersIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("employeesAnalyzed")}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {data.summary.totalEmployees}
                </p>
              </div>

              {/* Critical/Warning */}
              <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                    <AlertTriangleIcon className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("critical")} / {t("warning")}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {data.summary.critical + data.summary.warning}
                </p>
              </div>

              {/* Healthy */}
              <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("excellent")} / {t("good")}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {data.summary.excellent + data.summary.good}
                </p>
              </div>
            </div>

            {/* ── Distribution Bar ── */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm sm:p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t("distribution")}
              </h3>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
                {(
                  [
                    "critical",
                    "warning",
                    "caution",
                    "good",
                    "excellent",
                  ] as const
                ).map((level) => {
                  const count = data.summary[level];
                  const pct =
                    data.summary.totalEmployees > 0
                      ? (count / data.summary.totalEmployees) * 100
                      : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={level}
                      className={`${levelConfig[level].barColor} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                      title={`${t(level)}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {(
                  [
                    "excellent",
                    "good",
                    "caution",
                    "warning",
                    "critical",
                  ] as const
                ).map((level) => (
                  <div key={level} className="flex items-center gap-1.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${levelConfig[level].dot}`}
                    />
                    <span className="text-xs text-gray-600">
                      {t(level)} ({data.summary[level]})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t("allEmployees")} ({data.employees.length})
              </button>
              <button
                onClick={() => setFilter("atRisk")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === "atRisk"
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t("atRiskOnly")} (
                {
                  data.employees.filter((e) =>
                    ["critical", "warning", "caution"].includes(e.level),
                  ).length
                }
                )
              </button>
            </div>

            {/* ── Employee List ── */}
            {filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShieldCheckIcon className="mb-3 h-10 w-10 text-emerald-300" />
                <p className="text-sm text-gray-500">{t("noData")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEmployees.map((emp) => {
                  const cfg = levelConfig[emp.level];
                  const isExpanded = expandedId === emp.employeeId;

                  return (
                    <div
                      key={emp.employeeId}
                      className={`overflow-hidden rounded-2xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_2px_12px_-4px_rgba(0,0,0,0.08)] sm:border sm:border-gray-100 sm:shadow-sm transition-shadow hover:shadow-md`}
                    >
                      {/* Row */}
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : emp.employeeId)
                        }
                        className="flex w-full items-center gap-3 p-3 text-left sm:gap-4 sm:p-4"
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-10 sm:w-10 ${cfg.bg} ${cfg.color}`}
                        >
                          {emp.firstName[0]}
                          {emp.lastName[0]}
                        </div>

                        {/* Name & meta */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {emp.position || emp.departmentName || "—"}
                          </p>
                        </div>

                        {/* Stats (hidden on small screens) */}
                        <div className="hidden items-center gap-4 sm:flex">
                          <div className="text-right">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                              {t("shiftsInPeriod")}
                            </p>
                            <p className="text-sm font-semibold text-gray-700">
                              {emp.shiftsInPeriod}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                              {t("hoursInPeriod")}
                            </p>
                            <p className="text-sm font-semibold text-gray-700">
                              {emp.hoursInPeriod}h
                            </p>
                          </div>
                        </div>

                        {/* Score badge */}
                        <div
                          className={`flex flex-shrink-0 flex-col items-center rounded-lg px-3 py-1.5 ring-1 ${cfg.bg} ${cfg.ring}`}
                        >
                          <span
                            className={`text-lg font-bold leading-tight ${cfg.color}`}
                          >
                            {emp.score}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase ${cfg.color}`}
                          >
                            {t(emp.level)}
                          </span>
                        </div>

                        {/* Expand chevron */}
                        <svg
                          className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-6 sm:py-4">
                          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {t("riskFactors")}
                          </h4>

                          {emp.riskFactors.filter((f) => f.severity !== "low")
                            .length === 0 ? (
                            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                              <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-medium text-emerald-700">
                                {t("noRisks")}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {emp.riskFactors
                                .filter((f) => f.severity !== "low")
                                .sort((a, b) => {
                                  const order = {
                                    critical: 0,
                                    high: 1,
                                    medium: 2,
                                    low: 3,
                                  };
                                  return order[a.severity] - order[b.severity];
                                })
                                .map((factor) => (
                                  <div
                                    key={factor.key}
                                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${severityColors[factor.severity]}`}
                                      >
                                        {factor.severity}
                                      </span>
                                      <span className="text-xs font-medium text-gray-700">
                                        {t(
                                          factor.key as
                                            | "consecutiveDays"
                                            | "nightShifts"
                                            | "overtime"
                                            | "shortRest"
                                            | "weekendWork"
                                            | "totalHours",
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="font-semibold text-gray-900">
                                        {factor.value}
                                      </span>
                                      <span className="text-gray-400">
                                        / {t("threshold")}: {factor.threshold}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* ArbZG specific warning */}
                          {emp.riskFactors.some(
                            (f) =>
                              f.key === "shortRest" && f.severity !== "low",
                          ) && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                              <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                              <p className="text-xs font-medium text-red-700">
                                {t("arbzgWarning")}
                              </p>
                            </div>
                          )}

                          {/* Mobile stats */}
                          <div className="mt-3 flex gap-4 sm:hidden">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                                {t("shiftsInPeriod")}
                              </p>
                              <p className="text-sm font-semibold text-gray-700">
                                {emp.shiftsInPeriod}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                                {t("hoursInPeriod")}
                              </p>
                              <p className="text-sm font-semibold text-gray-700">
                                {emp.hoursInPeriod}h
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageContent>
    </>
  );
}
