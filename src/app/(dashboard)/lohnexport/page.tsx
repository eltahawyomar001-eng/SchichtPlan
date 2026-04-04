"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageContent } from "@/components/ui/page-content";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  FileExportIcon,
  DownloadIcon,
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ArrowRightIcon,
} from "@/components/icons";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { de, enUS } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface ExportSummary {
  employeeId: string;
  name: string;
  position: string | null;
  totalGrossHours: number;
  totalNetHours: number;
  totalBreakHours: number;
  days: number;
}

// ─── Component ──────────────────────────────────────────────────

export default function LohnexportPage() {
  const t = useTranslations("payrollExport");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "de" ? de : enUS;
  const { handlePlanLimit } = usePlanLimit();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [preview, setPreview] = useState<ExportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [showDatevInfo, setShowDatevInfo] = useState(false);

  // Default to previous month
  const lastMonth = subMonths(new Date(), 1);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(lastMonth), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(lastMonth), "yyyy-MM-dd"),
  );
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [exportFormat, setExportFormat] = useState("datev");

  // ── Fetch employees ─────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const d = await res.json();
        setEmployees(d.data ?? d);
      }
    } catch {
      // Non-critical — filter dropdown
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Preview ─────────────────────────────────────────────────

  async function handlePreview() {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        format: "json",
      });
      if (selectedEmployee) params.set("employeeId", selectedEmployee);

      const res = await fetch(`/api/export/datev?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
        setPreviewLoaded(true);
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }

  // ── Download ────────────────────────────────────────────────

  async function handleDownload() {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        format: exportFormat,
      });
      if (selectedEmployee) params.set("employeeId", selectedEmployee);

      const res = await fetch(`/api/export/datev?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lohnexport-${startDate}-${endDate}.${exportFormat === "datev" ? "csv" : exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) {
          const data = await res.json().catch(() => ({}));
          setLoadError(data.error || tc("errorOccurred"));
        }
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }

  // ── Quick date presets ──────────────────────────────────────

  function setPreset(months: number) {
    const target = subMonths(new Date(), months);
    setStartDate(format(startOfMonth(target), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(target), "yyyy-MM-dd"));
    setPreviewLoaded(false);
  }

  // ── Summary stats ───────────────────────────────────────────

  const totalHours = preview.reduce((sum, p) => sum + p.totalNetHours, 0);
  const totalEmployees = preview.length;

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <PageContent>
        {/* Error */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
          </div>
        )}

        {/* ─── Info Banner: What is this page? ─────────────── */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <AlertCircleIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-blue-900">
                {t("infoBannerTitle")}
              </p>
              <p className="text-sm text-blue-800 leading-relaxed">
                {t("infoBannerText")}
              </p>
            </div>
          </div>
        </div>

        {/* ─── How it works — 3-step visual guide ──────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            {
              step: "step1Title" as const,
              desc: "step1Desc" as const,
              icon: <ClockIcon className="h-5 w-5 text-emerald-600" />,
              active: !previewLoaded,
            },
            {
              step: "step2Title" as const,
              desc: "step2Desc" as const,
              icon: <FileExportIcon className="h-5 w-5 text-emerald-600" />,
              active: previewLoaded && preview.length > 0,
            },
            {
              step: "step3Title" as const,
              desc: "step3Desc" as const,
              icon: <DownloadIcon className="h-5 w-5 text-emerald-600" />,
              active: false,
            },
          ].map((s) => (
            <div
              key={s.step}
              className={`rounded-xl border p-4 transition-all ${
                s.active
                  ? "border-emerald-300 bg-emerald-50/60 shadow-sm"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                {s.icon}
                <p
                  className={`text-sm font-semibold ${s.active ? "text-emerald-700" : "text-gray-700"}`}
                >
                  {t(s.step)}
                </p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t(s.desc)}
              </p>
            </div>
          ))}
        </div>

        {/* ─── Prerequisites checklist ─────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              {t("requirementsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t("requirementConfirmed")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("requirementConfirmedHint")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t("requirementPeriod")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("requirementPeriodHint")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Configuration ───────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileExportIcon className="h-5 w-5 text-emerald-600" />
              {t("configure")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick presets */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">
                {t("quickSelect")}
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: t("lastMonth"), months: 1 },
                  { label: t("monthBefore"), months: 2 },
                  { label: t("currentMonth"), months: 0 },
                ].map((preset) => (
                  <button
                    key={preset.months}
                    onClick={() => setPreset(preset.months)}
                    className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>{tc("from")}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPreviewLoaded(false);
                  }}
                />
              </div>
              <div>
                <Label>{tc("to")}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPreviewLoaded(false);
                  }}
                />
              </div>
              <div>
                <Label>{tc("employee")}</Label>
                <Select
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    setPreviewLoaded(false);
                  }}
                >
                  <option value="">{tc("allEmployees")}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t("format")}</Label>
                <Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                >
                  <option value="datev">{t("datev")}</option>
                  <option value="csv">{t("csv")}</option>
                </Select>
                <button
                  type="button"
                  onClick={() => setShowFormatHelp(!showFormatHelp)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1.5 underline underline-offset-2"
                >
                  {t("formatHelpTitle")}
                </button>
              </div>
            </div>

            {/* Format help expandable */}
            {showFormatHelp && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">
                  {t("formatHelpTitle")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className={`rounded-lg border p-3 ${exportFormat === "datev" ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200 bg-white"}`}
                  >
                    <p className="text-sm font-semibold text-gray-800">
                      {t("datev")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {t("datevHint")}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${exportFormat === "csv" ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200 bg-white"}`}
                  >
                    <p className="text-sm font-semibold text-gray-800">
                      {t("csv")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {t("csvHint")}
                    </p>
                  </div>
                </div>
                {/* DATEV explainer */}
                <button
                  type="button"
                  onClick={() => setShowDatevInfo(!showDatevInfo)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2"
                >
                  {t("whatIsDatev")}
                </button>
                {showDatevInfo && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {t("datevExplainer")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tip */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
              <span
                className="text-amber-600 text-base mt-0.5"
                aria-hidden="true"
              >
                💡
              </span>
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  {t("tipTitle")}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">{t("tipText")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={loading}
              >
                {loading ? tc("loading") : tc("preview")}
              </Button>
              <Button onClick={handleDownload} disabled={loading}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t("downloadCsv")}</span>
                <span className="sm:hidden">{tc("download")}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Preview summary ─────────────────────────────── */}
        {previewLoaded && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl stat-icon-emerald p-2.5">
                      <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">
                        {totalEmployees}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 break-words">
                        {tc("employees")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl stat-icon-emerald p-2.5">
                      <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">
                        {totalHours.toFixed(2)}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 break-words">
                        {t("netHours")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-employee breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("summary")}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    {format(new Date(startDate), "dd.MM.yyyy", {
                      locale: dateFnsLocale,
                    })}{" "}
                    –{" "}
                    {format(new Date(endDate), "dd.MM.yyyy", {
                      locale: dateFnsLocale,
                    })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {preview.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <FileExportIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-700">
                      {t("noEntries")}
                    </p>
                    <div className="text-left max-w-sm mx-auto space-y-2">
                      <p className="text-xs font-medium text-gray-500">
                        {t("noEntriesHint")}
                      </p>
                      <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                        <li>{t("noEntriesReason1")}</li>
                        <li>{t("noEntriesReason2")}</li>
                      </ul>
                    </div>
                    <a
                      href="/zeiterfassung"
                      className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-2"
                    >
                      {t("goToTimeTracking")}
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-500">
                            {tc("employee")}
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500">
                            {tc("days")}
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500 hidden sm:table-cell">
                            {t("gross")}
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500 hidden sm:table-cell">
                            {t("break")}
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500">
                            {t("net")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr
                            key={row.employeeId}
                            className="border-b border-gray-50 last:border-0"
                          >
                            <td className="py-2.5 px-3">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {row.name}
                                </p>
                                {row.position && (
                                  <p className="text-xs text-gray-400">
                                    {row.position}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-2.5 px-3 text-gray-700">
                              {row.days}
                            </td>
                            <td className="text-right py-2.5 px-3 text-gray-700 hidden sm:table-cell">
                              {row.totalGrossHours.toFixed(2)} {tc("hrsShort")}
                            </td>
                            <td className="text-right py-2.5 px-3 text-gray-700 hidden sm:table-cell">
                              {row.totalBreakHours.toFixed(2)} {tc("hrsShort")}
                            </td>
                            <td className="text-right py-2.5 px-3 font-medium text-gray-900">
                              {row.totalNetHours.toFixed(2)} {tc("hrsShort")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            {tc("total")}
                          </td>
                          <td className="text-right py-2.5 px-3 font-bold text-gray-900">
                            {preview.reduce((s, r) => s + r.days, 0)}
                          </td>
                          <td className="text-right py-2.5 px-3 font-bold text-gray-900 hidden sm:table-cell">
                            {preview
                              .reduce((s, r) => s + r.totalGrossHours, 0)
                              .toFixed(2)}{" "}
                            {tc("hrsShort")}
                          </td>
                          <td className="text-right py-2.5 px-3 font-bold text-gray-900 hidden sm:table-cell">
                            {preview
                              .reduce((s, r) => s + r.totalBreakHours, 0)
                              .toFixed(2)}{" "}
                            {tc("hrsShort")}
                          </td>
                          <td className="text-right py-2.5 px-3 font-bold text-gray-900">
                            {totalHours.toFixed(2)} {tc("hrsShort")}
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Confirmation note */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 italic">
                        {t("onlyConfirmed")}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ─── Initial help ────────────────────────────────── */}
        {!previewLoaded && (
          <Card>
            <CardContent className="py-10 sm:py-10 text-center">
              <FileExportIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("helpText")}</p>
              <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
                {t("helpHint")}
              </p>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </div>
  );
}
