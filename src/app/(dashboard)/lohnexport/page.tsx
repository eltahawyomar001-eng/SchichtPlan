"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  FileExportIcon,
  DownloadIcon,
  ClockIcon,
  UsersIcon,
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [preview, setPreview] = useState<ExportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

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
      if (res.ok) setEmployees(await res.json());
    } catch (err) {
      console.error("Fehler:", err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Preview ─────────────────────────────────────────────────

  async function handlePreview() {
    setLoading(true);
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
      }
    } catch (err) {
      console.error("Fehler:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Download ────────────────────────────────────────────────

  function handleDownload() {
    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      format: exportFormat,
    });
    if (selectedEmployee) params.set("employeeId", selectedEmployee);

    // Trigger browser download
    window.location.href = `/api/export/datev?${params}`;
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

      <div className="p-4 sm:p-6 space-y-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileExportIcon className="h-5 w-5 text-violet-600" />
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
                    className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
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
              <Button onClick={handleDownload}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t("downloadCsv")}</span>
                <span className="sm:hidden">{tc("download")}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview summary */}
        {previewLoaded && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-violet-50 p-2">
                      <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
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
                    <div className="rounded-lg bg-emerald-50 p-2">
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
                  <div className="text-center py-10">
                    <FileExportIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">{t("noEntries")}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t("onlyConfirmed")}
                    </p>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Help info */}
        {!previewLoaded && (
          <Card>
            <CardContent className="py-10 text-center">
              <FileExportIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("helpText")}</p>
              <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
                {t("helpHint")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
