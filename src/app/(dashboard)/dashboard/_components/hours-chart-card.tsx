"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

/* ── Types ── */
export interface DailyHours {
  date: string; // "YYYY-MM-DD"
  label: string; // display label e.g. "13.04.2026" or "Mo"
  hours: number;
}

type Period = "week" | "month" | "year";

interface HoursChartCardProps {
  weekData: DailyHours[];
  monthData: DailyHours[];
  yearData: DailyHours[];
  dateRange: string; // e.g. "13.4.2026 – 13.4.2026"
  title: string;
  avgLabel: (hours: string) => string; // "Ø {hours} Std pro Tag"
  periodLabels: { week: string; month: string; year: string };
  todayLabel: string;
}

/* ── SVG sparkline ── */
function Sparkline({
  data,
  width,
  height,
}: {
  data: DailyHours[];
  width: number;
  height: number;
}) {
  const values = data.map((d) => d.hours);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  // Padding
  const px = 32;
  const py = 20;
  const chartW = width - px * 2;
  const chartH = height - py * 2;

  // Compute points
  const points = values.map((v, i) => ({
    x: px + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: py + chartH - ((v - min) / range) * chartH,
  }));

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = min + (range / tickCount) * i;
    return {
      val: Math.round(val * 10) / 10,
      y: py + chartH - ((val - min) / range) * chartH,
    };
  });

  // Smooth path using cardinal spline
  const pathD =
    points.length < 2
      ? ""
      : points.reduce((acc, p, i) => {
          if (i === 0) return `M ${p.x} ${p.y}`;
          const prev = points[i - 1];
          const cpx = (prev.x + p.x) / 2;
          return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
        }, "");

  // Gradient area path
  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${py + chartH} L ${points[0].x} ${py + chartH} Z`
    : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.01} />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {yTicks.map((tick) => (
        <g key={tick.val}>
          <line
            x1={px}
            y1={tick.y}
            x2={width - px}
            y2={tick.y}
            stroke="currentColor"
            className="text-gray-100 dark:text-zinc-800"
            strokeWidth={1}
          />
          <text
            x={px - 6}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-gray-400 dark:fill-zinc-500 text-[11px]"
          >
            {tick.val.toFixed(1).replace(".", ",")}
          </text>
        </g>
      ))}

      {/* Gradient area fill */}
      {areaD && <path d={areaD} fill="url(#chartGrad)" />}

      {/* Line */}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#06b6d4"
          stroke="white"
          strokeWidth={2}
          className="dark:stroke-zinc-900"
        />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
        // For large datasets show every Nth label
        const skip = data.length > 12 ? Math.ceil(data.length / 6) : 1;
        if (i % skip !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={d.date}
            x={points[i].x}
            y={height - 2}
            textAnchor="middle"
            className="fill-gray-400 dark:fill-zinc-500 text-[10px]"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export function HoursChartCard({
  weekData,
  monthData,
  yearData,
  dateRange,
  title,
  avgLabel,
  periodLabels,
  todayLabel,
}: HoursChartCardProps) {
  const [period, setPeriod] = useState<Period>("week");

  const data = useMemo(() => {
    if (period === "week") return weekData;
    if (period === "month") return monthData;
    return yearData;
  }, [period, weekData, monthData, yearData]);

  const avgHours = useMemo(() => {
    if (data.length === 0) return "0";
    const daysWithData = data.filter((d) => d.hours > 0);
    if (daysWithData.length === 0) return "0";
    const avg =
      daysWithData.reduce((s, d) => s + d.hours, 0) / daysWithData.length;
    return Math.round(avg).toString();
  }, [data]);

  const tabs: { key: Period; label: string }[] = [
    { key: "week", label: periodLabels.week },
    { key: "month", label: periodLabels.month },
    { key: "year", label: periodLabels.year },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header: tabs + date nav */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 pt-5 pb-3">
          {/* Period tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-zinc-800 p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriod(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === tab.key
                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date range + nav */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
            <span className="tabular-nums">{dateRange}</span>
            <div className="flex items-center gap-1">
              <button className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="font-medium text-gray-700 dark:text-zinc-300">
                {todayLabel}
              </span>
              <button className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Title row + average */}
        <div className="flex items-end justify-between px-5 pb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {title}
          </h3>
          <span className="text-lg font-bold text-cyan-500">
            {avgLabel(avgHours)}
          </span>
        </div>

        {/* Chart */}
        <div className="h-48 sm:h-56 px-2">
          {data.length > 0 ? (
            <Sparkline data={data} width={600} height={220} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
              —
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
