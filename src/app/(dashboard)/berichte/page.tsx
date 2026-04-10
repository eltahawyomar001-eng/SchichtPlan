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
import { PageContent } from "@/components/ui/page-content";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";

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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { handlePlanLimit } = usePlanLimit();

  // Chart colors adapted to current theme
  const chartColors = {
    tick: isDark ? "#a1a1aa" : "#6b7280", // zinc-400 / gray-500
    grid: isDark ? "#27272a" : "#f0f0f0", // zinc-800 / light gray
    tooltipBg: isDark ? "#18181b" : "#ffffff", // zinc-900 / white
    tooltipBorder: isDark ? "#3f3f46" : "#e5e7eb", // zinc-700 / gray-200
    tooltipText: isDark ? "#e4e4e7" : "#111827", // zinc-200 / gray-900
    labelText: isDark ? "#a1a1aa" : "#6b7280", // zinc-400 / gray-500
    legendText: isDark ? "#d4d4d8" : "#374151", // zinc-300 / gray-700
  };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

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
      <PageContent>
        {/* Error */}
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-800 dark:text-red-400">
            {loadError}
          </div>
        )}

        {/* Date range filter + export */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-sm text-gray-600 dark:text-zinc-400 flex-shrink-0">
              {t("from")}
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 min-w-0"
            />
            <label className="text-sm text-gray-600 dark:text-zinc-400 flex-shrink-0">
              {t("to")}
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 min-w-0"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("xlsx")}
              disabled={exporting || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={exporting || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              PDF
            </Button>
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
                <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {t("employeeHours")}
                  </h2>
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <div
                      style={{
                        minWidth: Math.max(
                          320,
                          data.employeeStats.slice(0, 10).length * 60,
                        ),
                      }}
                    >
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={data.employeeStats.slice(0, 10)}
                          margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={chartColors.grid}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: chartColors.tick }}
                            angle={-45}
                            textAnchor="end"
                            height={70}
                            tickFormatter={(name: string) =>
                              name.length > 12 ? `${name.slice(0, 11)}…` : name
                            }
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: chartColors.tick }}
                            width={40}
                          />
                          <Tooltip
                            formatter={(val) => [`${val}h`, t("totalHours")]}
                            contentStyle={{
                              backgroundColor: chartColors.tooltipBg,
                              borderColor: chartColors.tooltipBorder,
                              color: chartColors.tooltipText,
                              borderRadius: 8,
                            }}
                            labelStyle={{ color: chartColors.tooltipText }}
                            itemStyle={{ color: chartColors.tooltipText }}
                          />
                          <Bar
                            dataKey="hours"
                            fill="#059669"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Shift Types Pie Chart */}
              {shiftTypeData.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {t("totalShifts")}
                  </h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={shiftTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        dataKey="value"
                        paddingAngle={3}
                        label={({ name, percent }) =>
                          `${(name ?? "").length > 10 ? (name ?? "").slice(0, 9) + "…" : (name ?? "")} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={{ stroke: chartColors.tick }}
                      >
                        {shiftTypeData.map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={COLORS[idx % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartColors.tooltipBg,
                          borderColor: chartColors.tooltipBorder,
                          color: chartColors.tooltipText,
                          borderRadius: 8,
                        }}
                        itemStyle={{ color: chartColors.tooltipText }}
                      />
                      <Legend
                        wrapperStyle={{ color: chartColors.legendText }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Absence Pie Chart */}
            {absenceData.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm max-w-md">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">
                  {t("absences")}
                </h2>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={absenceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: chartColors.tick }}
                    >
                      {absenceData.map((entry, idx) => (
                        <Cell key={`abs-${idx}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartColors.tooltipBg,
                        borderColor: chartColors.tooltipBorder,
                        color: chartColors.tooltipText,
                        borderRadius: 8,
                      }}
                      itemStyle={{ color: chartColors.tooltipText }}
                    />
                    <Legend wrapperStyle={{ color: chartColors.legendText }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Employee hours ranking table */}
            {data.employeeStats.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
                <div className="border-b border-gray-200 dark:border-zinc-700 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {t("employeeHours")}
                  </h2>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {data.employeeStats.map((emp, idx) => (
                    <li
                      key={emp.employeeId}
                      className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-medium text-gray-600 dark:text-zinc-400 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                          {emp.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                          {emp.hours}h
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-zinc-400">
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
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {t("noData")}
          </p>
        )}
      </PageContent>
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
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ? accentColors[accent] : "text-gray-900 dark:text-zinc-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
