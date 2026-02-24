"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DownloadIcon } from "@/components/icons";

interface ReportData {
  period: { start: string; end: string };
  summary: {
    totalShifts: number;
    totalShiftHours: number;
    openShifts: number;
    nightShifts: number;
    holidayShifts: number;
    sundayShifts: number;
    totalEmployees: number;
    avgHoursPerEmployee: number;
  };
  absences: {
    pending: number;
    approved: number;
    rejected: number;
  };
  employeeStats: {
    employeeId: string;
    name: string;
    hours: number;
    shifts: number;
  }[];
}

const COLORS = [
  "#059669",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
];

export default function BerichteSeite() {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const { handlePlanLimit } = usePlanLimit();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Default: current month
  const now = new Date();
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [endDate, setEndDate] = useState(
    `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?start=${startDate}&end=${endDate}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) setLoadError(tc("errorLoading"));
      }
    } catch {
      setLoadError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, tc]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format: "xlsx" | "csv" | "pdf") => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        type: "shifts",
        format,
        start: startDate,
        end: endDate,
      });
      const res = await fetch(`/api/export/download?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shiftfy-bericht-${startDate}-${endDate}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    } finally {
      setExporting(false);
    }
  };

  // Prepare chart data
  const shiftTypeData = data
    ? [
        { name: t("nightShifts"), value: data.summary.nightShifts },
        { name: t("sundayShifts"), value: data.summary.sundayShifts },
        { name: t("holidayShifts"), value: data.summary.holidayShifts },
        {
          name: t("totalShifts"),
          value:
            data.summary.totalShifts -
            data.summary.nightShifts -
            data.summary.sundayShifts -
            data.summary.holidayShifts,
        },
      ].filter((d) => d.value > 0)
    : [];

  const absenceData = data
    ? [
        { name: t("pending"), value: data.absences.pending, fill: "#F59E0B" },
        {
          name: t("approved"),
          value: data.absences.approved,
          fill: "#10B981",
        },
        {
          name: t("rejected"),
          value: data.absences.rejected,
          fill: "#EF4444",
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Error */}
        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
          </div>
        )}

        {/* Date range filter + export */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">{t("from")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <label className="text-sm text-gray-600">{t("to")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleExport("xlsx")}
              disabled={exporting || !data}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || !data}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting || !data}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label={t("totalShifts")}
                value={String(data.summary.totalShifts)}
              />
              <StatCard
                label={t("totalHours")}
                value={`${data.summary.totalShiftHours}h`}
              />
              <StatCard
                label={t("openShifts")}
                value={String(data.summary.openShifts)}
                accent={data.summary.openShifts > 0 ? "amber" : undefined}
              />
              <StatCard
                label={t("avgHoursPerEmployee")}
                value={`${data.summary.avgHoursPerEmployee}h`}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Employee Hours Bar Chart */}
              {data.employeeStats.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    {t("employeeHours")}
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={data.employeeStats.slice(0, 10)}
                      margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-35}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(val) => [`${val}h`, t("totalHours")]}
                      />
                      <Bar
                        dataKey="hours"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Shift Types Pie Chart */}
              {shiftTypeData.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    {t("totalShifts")}
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={shiftTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        paddingAngle={3}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {shiftTypeData.map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={COLORS[idx % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Absence Pie Chart */}
            {absenceData.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-md">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  {t("absences")}
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={absenceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {absenceData.map((entry, idx) => (
                        <Cell key={`abs-${idx}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Employee hours ranking table */}
            {data.employeeStats.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("employeeHours")}
                  </h2>
                </div>
                <ul className="divide-y divide-gray-100">
                  {data.employeeStats.map((emp, idx) => (
                    <li
                      key={emp.employeeId}
                      className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {emp.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-900">
                          {emp.hours}h
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({emp.shifts} {t("shifts")})
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("noData")}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "amber" | "blue" | "red";
}) {
  const accentColors = {
    amber: "text-amber-600",
    blue: "text-emerald-600",
    red: "text-red-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ? accentColors[accent] : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}
