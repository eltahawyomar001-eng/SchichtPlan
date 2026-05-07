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
  timeTracking: {
    totalEntries: number;
    totalTrackedHours: number;
    totalBreakHours: number;
    liveClockEntries: number;
    byStatus: Record<string, number>;
  };
  absences: {
    pending: number;
    approved: number;
    rejected: number;
  };
  absencesByCategory: Record<string, number>;
  employeeStats: {
    employeeId: string;
    name: string;
    hours: number;
    shifts: number;
  }[];
  employeeTimeStats: {
    employeeId: string;
    name: string;
    hours: number;
    entries: number;
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

const STATUS_COLORS: Record<string, string> = {
  ENTWURF: "#94a3b8",
  EINGEREICHT: "#3B82F6",
  BESTAETIGT: "#059669",
  ABGELEHNT: "#EF4444",
};

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return fmtDate(last);
}

export default function BerichteSeite() {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { handlePlanLimit } = usePlanLimit();

  const chartColors = {
    tick: isDark ? "#d4d4d8" : "#374151",
    grid: isDark ? "#27272a" : "#e5e7eb",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e5e7eb",
    tooltipText: isDark ? "#e4e4e7" : "#111827",
    labelText: isDark ? "#d4d4d8" : "#374151",
    legendText: isDark ? "#d4d4d8" : "#374151",
    axisLine: isDark ? "#3f3f46" : "#d1d5db",
  };

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingDatev, setExportingDatev] = useState(false);

  const now = new Date();
  const [startDate, setStartDate] = useState(monthStart(now));
  const [endDate, setEndDate] = useState(monthEnd(now));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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

  function setPreset(preset: "week" | "month" | "lastMonth" | "3months") {
    const n = new Date();
    if (preset === "week") {
      const day = n.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(n);
      mon.setDate(n.getDate() + diff);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(fmtDate(mon));
      setEndDate(fmtDate(sun));
    } else if (preset === "month") {
      setStartDate(monthStart(n));
      setEndDate(monthEnd(n));
    } else if (preset === "lastMonth") {
      const last = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      setStartDate(monthStart(last));
      setEndDate(monthEnd(last));
    } else {
      const three = new Date(n.getFullYear(), n.getMonth() - 2, 1);
      setStartDate(monthStart(three));
      setEndDate(monthEnd(n));
    }
  }

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

  const handleDatevExport = async () => {
    setExportingDatev(true);
    try {
      const month = startDate.slice(0, 7);
      const res = await fetch(`/api/time-entries/export/datev?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `datev-lohn-${month}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setLoadError(tc("errorOccurred"));
    } finally {
      setExportingDatev(false);
    }
  };

  // ── Chart data derivations ──

  const statusLabelMap: Record<string, string> = {
    ENTWURF: t("statusEntwurf"),
    EINGEREICHT: t("statusEingereicht"),
    BESTAETIGT: t("statusBestaetigt"),
    ABGELEHNT: t("statusAbgelehnt"),
  };

  const categoryLabelMap: Record<string, string> = {
    URLAUB: t("catUrlaub"),
    KRANKHEIT: t("catKrankheit"),
    SONDERURLAUB: t("catSonderurlaub"),
    ELTERNZEIT: t("catElternzeit"),
    SONSTIG: t("catSonstig"),
  };

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

  const absenceStatusData = data
    ? [
        { name: t("pending"), value: data.absences.pending, fill: "#F59E0B" },
        { name: t("approved"), value: data.absences.approved, fill: "#10B981" },
        { name: t("rejected"), value: data.absences.rejected, fill: "#EF4444" },
      ].filter((d) => d.value > 0)
    : [];

  const entryStatusData = data
    ? Object.entries(data.timeTracking.byStatus).map(([status, count]) => ({
        name: statusLabelMap[status] ?? status,
        value: count,
        fill: STATUS_COLORS[status] ?? "#8B5CF6",
      }))
    : [];

  const absenceCategoryData = data
    ? Object.entries(data.absencesByCategory)
        .map(([cat, count]) => ({
          name: categoryLabelMap[cat] ?? cat,
          value: count,
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const plannedVsActualData = data
    ? (() => {
        const map = new Map<
          string,
          { name: string; planned: number; actual: number }
        >();
        for (const e of data.employeeStats) {
          map.set(e.employeeId, {
            name: e.name,
            planned: e.hours,
            actual: 0,
          });
        }
        for (const e of data.employeeTimeStats) {
          const existing = map.get(e.employeeId);
          if (existing) {
            existing.actual = e.hours;
          } else {
            map.set(e.employeeId, {
              name: e.name,
              planned: 0,
              actual: e.hours,
            });
          }
        }
        return Array.from(map.values())
          .filter((d) => d.planned > 0 || d.actual > 0)
          .sort((a, b) => b.planned - a.planned)
          .slice(0, 10);
      })()
    : [];

  const tooltipStyle = {
    backgroundColor: chartColors.tooltipBg,
    borderColor: chartColors.tooltipBorder,
    color: chartColors.tooltipText,
    borderRadius: 8,
    fontSize: 13,
  };

  const hasTimeData =
    data &&
    (data.timeTracking.totalTrackedHours > 0 ||
      data.timeTracking.totalEntries > 0);

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent>
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-800 dark:text-red-400">
            {loadError}
          </div>
        )}

        {/* Quick-select presets */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["week", t("thisWeek")],
              ["month", t("thisMonth")],
              ["lastMonth", t("lastMonth")],
              ["3months", t("last3Months")],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPreset(preset)}
              className="rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range + exports */}
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
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("xlsx")}
              disabled={exporting || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              {t("exportExcel")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              {t("exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={exporting || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              {t("exportPdf")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDatevExport}
              disabled={exportingDatev || !data}
            >
              <DownloadIcon className="h-4 w-4" />
              {t("exportDatev")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Shift summary cards */}
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

            {/* Time tracking cards */}
            {hasTimeData && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  {t("timeTracking")}
                </h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <StatCard
                    label={t("trackedHours")}
                    value={`${data.timeTracking.totalTrackedHours}h`}
                    accent="green"
                  />
                  <StatCard
                    label={t("breakHours")}
                    value={`${data.timeTracking.totalBreakHours}h`}
                  />
                  <StatCard
                    label={t("liveClockEntries")}
                    value={String(data.timeTracking.liveClockEntries)}
                    accent={
                      data.timeTracking.liveClockEntries > 0
                        ? "blue"
                        : undefined
                    }
                  />
                </div>
              </div>
            )}

            {/* Charts grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Employee planned hours */}
              {data.employeeStats.length > 0 && (
                <ChartCard title={t("employeeHours")}>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(
                      200,
                      data.employeeStats.slice(0, 10).length * 44 + 40,
                    )}
                  >
                    <BarChart
                      data={data.employeeStats.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.grid}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: chartColors.tick }}
                        stroke={chartColors.axisLine}
                        tickLine={false}
                        axisLine={false}
                        unit="h"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 13, fill: chartColors.tick }}
                        stroke={chartColors.axisLine}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                      />
                      <Tooltip
                        formatter={(val) => [`${val}h`, t("totalHours")]}
                        contentStyle={tooltipStyle}
                        labelStyle={{
                          color: chartColors.tooltipText,
                          fontWeight: 600,
                        }}
                        itemStyle={{ color: chartColors.tooltipText }}
                        cursor={{ fill: isDark ? "#27272a" : "#f3f4f6" }}
                      />
                      <Bar
                        dataKey="hours"
                        fill="#059669"
                        radius={[0, 6, 6, 0]}
                        barSize={28}
                        label={{
                          position: "right",
                          fill: chartColors.labelText,
                          fontSize: 12,
                          fontWeight: 600,
                          formatter: (v: unknown) => `${v}h`,
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Shift types donut */}
              {shiftTypeData.length > 0 && (
                <ChartCard title={t("totalShifts")}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={shiftTypeData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={95}
                        dataKey="value"
                        paddingAngle={3}
                        label={(props) => {
                          const RADIAN = Math.PI / 180;
                          const cx = Number(props.cx ?? 0);
                          const cy = Number(props.cy ?? 0);
                          const midAngle = Number(props.midAngle ?? 0);
                          const or = Number(props.outerRadius ?? 95);
                          const percent = Number(props.percent ?? 0);
                          const radius = or + 18;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={chartColors.labelText}
                              textAnchor={x > cx ? "start" : "end"}
                              dominantBaseline="central"
                              fontSize={13}
                              fontWeight={600}
                            >
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                          );
                        }}
                        labelLine={{
                          stroke: chartColors.axisLine,
                          strokeWidth: 1,
                        }}
                      >
                        {shiftTypeData.map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={COLORS[idx % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: chartColors.tooltipText }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => (
                          <span
                            style={{
                              color: chartColors.legendText,
                              fontSize: 13,
                            }}
                          >
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Time entry status breakdown */}
              {entryStatusData.length > 0 && (
                <ChartCard title={t("entryStatus")}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={entryStatusData}
                      margin={{ top: 8, right: 24, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: chartColors.tick }}
                        stroke={chartColors.axisLine}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: chartColors.tick }}
                        stroke={chartColors.axisLine}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(val) => [val, t("entries")]}
                        contentStyle={tooltipStyle}
                        labelStyle={{
                          color: chartColors.tooltipText,
                          fontWeight: 600,
                        }}
                        itemStyle={{ color: chartColors.tooltipText }}
                        cursor={{ fill: isDark ? "#27272a" : "#f3f4f6" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {entryStatusData.map((entry, idx) => (
                          <Cell key={`status-${idx}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Absence by category */}
              {absenceCategoryData.length > 0 && (
                <ChartCard title={t("absencesByCategory")}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={absenceCategoryData}
                      margin={{ top: 8, right: 24, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: chartColors.tick }}
                        stroke={chartColors.axisLine}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: chartColors.tick }}
                        stroke={chartColors.axisLine}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{
                          color: chartColors.tooltipText,
                          fontWeight: 600,
                        }}
                        itemStyle={{ color: chartColors.tooltipText }}
                        cursor={{ fill: isDark ? "#27272a" : "#f3f4f6" }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[6, 6, 0, 0]}
                        barSize={40}
                        fill="#3B82F6"
                      >
                        {absenceCategoryData.map((_, idx) => (
                          <Cell
                            key={`cat-${idx}`}
                            fill={COLORS[idx % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>

            {/* Planned vs. Actual — full width grouped bar */}
            {plannedVsActualData.length > 0 && (
              <ChartCard title={t("plannedVsActual")}>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, plannedVsActualData.length * 44 + 40)}
                >
                  <BarChart
                    data={plannedVsActualData}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartColors.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: chartColors.tick }}
                      stroke={chartColors.axisLine}
                      tickLine={false}
                      axisLine={false}
                      unit="h"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 13, fill: chartColors.tick }}
                      stroke={chartColors.axisLine}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip
                      formatter={(val, name) => [
                        `${val}h`,
                        name === "planned" ? t("planned") : t("actual"),
                      ]}
                      contentStyle={tooltipStyle}
                      labelStyle={{
                        color: chartColors.tooltipText,
                        fontWeight: 600,
                      }}
                      itemStyle={{ color: chartColors.tooltipText }}
                      cursor={{ fill: isDark ? "#27272a" : "#f3f4f6" }}
                    />
                    <Legend
                      verticalAlign="top"
                      iconType="circle"
                      iconSize={10}
                      formatter={(value) => (
                        <span
                          style={{
                            color: chartColors.legendText,
                            fontSize: 13,
                          }}
                        >
                          {value === "planned" ? t("planned") : t("actual")}
                        </span>
                      )}
                    />
                    <Bar
                      dataKey="planned"
                      fill="#059669"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                    <Bar
                      dataKey="actual"
                      fill="#3B82F6"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Absence status pie */}
            {absenceStatusData.length > 0 && (
              <div className="max-w-md">
                <ChartCard title={t("absences")}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={absenceStatusData}
                        cx="50%"
                        cy="45%"
                        outerRadius={80}
                        dataKey="value"
                        label={(props) => {
                          const RADIAN = Math.PI / 180;
                          const cx = Number(props.cx ?? 0);
                          const cy = Number(props.cy ?? 0);
                          const midAngle = Number(props.midAngle ?? 0);
                          const or = Number(props.outerRadius ?? 80);
                          const value = Number(props.value ?? 0);
                          const radius = or + 18;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={chartColors.labelText}
                              textAnchor={x > cx ? "start" : "end"}
                              dominantBaseline="central"
                              fontSize={13}
                              fontWeight={600}
                            >
                              {value}
                            </text>
                          );
                        }}
                        labelLine={{
                          stroke: chartColors.axisLine,
                          strokeWidth: 1,
                        }}
                      >
                        {absenceStatusData.map((entry, idx) => (
                          <Cell key={`abs-${idx}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: chartColors.tooltipText }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => (
                          <span
                            style={{
                              color: chartColors.legendText,
                              fontSize: 13,
                            }}
                          >
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}

            {/* Employee ranking table — shows both planned and tracked */}
            {(data.employeeStats.length > 0 ||
              data.employeeTimeStats.length > 0) && (
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 dark:border-zinc-700 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {t("employeeHours")}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400 w-8">
                          #
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                          Name
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                          {t("planned")}
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                          {t("actual")}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                          {t("shifts")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {plannedVsActualData.map((emp, idx) => {
                        const shiftCount =
                          data.employeeStats.find((e) => e.name === emp.name)
                            ?.shifts ?? 0;
                        const delta = emp.actual - emp.planned;
                        return (
                          <tr
                            key={emp.name}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="px-6 py-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-medium text-gray-600 dark:text-zinc-400">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-medium text-gray-900 dark:text-zinc-100 truncate max-w-[160px]">
                              {emp.name}
                            </td>
                            <td className="px-3 py-3 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                              {emp.planned > 0 ? `${emp.planned}h` : "—"}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {emp.actual > 0 ? (
                                <span
                                  className={
                                    delta > 0.5
                                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                      : delta < -0.5
                                        ? "text-red-600 dark:text-red-400 font-medium"
                                        : "text-gray-700 dark:text-zinc-300"
                                  }
                                >
                                  {emp.actual}h
                                  {Math.abs(delta) > 0.5 && (
                                    <span className="ml-1 text-xs">
                                      ({delta > 0 ? "+" : ""}
                                      {delta.toFixed(1)}h)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-zinc-500">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-500 dark:text-zinc-400">
                              {shiftCount > 0 ? shiftCount : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800">
              <svg
                className="h-6 w-6 text-gray-400 dark:text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
              {t("noData")}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              {t("noDataEmpty")}
            </p>
          </div>
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
  accent?: "amber" | "blue" | "red" | "green";
}) {
  const accentColors = {
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
    green: "text-emerald-600 dark:text-emerald-400",
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

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-zinc-100">
        {title}
      </h2>
      {children}
    </div>
  );
}
