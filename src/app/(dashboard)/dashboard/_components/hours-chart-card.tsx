"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

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
  avgLabelTemplate: string; // e.g. "Ø {hours} Std pro Tag" — {hours} gets replaced client-side
  periodLabels: { week: string; month: string; year: string };
  todayLabel: string;
}

/* ── Emerald brand palette ── */
const BRAND = {
  line: "#059669", // emerald-600
  dot: "#10b981", // emerald-500
  gradientFrom: "rgba(16, 185, 129, 0.18)", // emerald-500 / 18%
  gradientTo: "rgba(16, 185, 129, 0.01)", // emerald-500 / 1%
} as const;

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

  // Tight padding — keep as much room for the chart as possible
  const px = 36;
  const pt = 12;
  const pb = 22;
  const chartW = width - px - 12; // left label gutter + right bleed room
  const chartH = height - pt - pb;

  // Compute points
  const points = values.map((v, i) => ({
    x: px + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: pt + chartH - ((v - min) / range) * chartH,
  }));

  // Y-axis ticks (6 lines including 0)
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = min + (range / tickCount) * i;
    return {
      val: Math.round(val * 10) / 10,
      y: pt + chartH - ((val - min) / range) * chartH,
    };
  });

  // Smooth cubic Bézier path
  const pathD =
    points.length < 2
      ? ""
      : points.reduce((acc, p, i) => {
          if (i === 0) return `M ${p.x} ${p.y}`;
          const prev = points[i - 1];
          const cpx = (prev.x + p.x) / 2;
          return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
        }, "");

  // Gradient fill area
  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${pt + chartH} L ${points[0].x} ${pt + chartH} Z`
    : "";

  // X-axis label spacing
  const maxXLabels = 8;
  const skip =
    data.length > maxXLabels ? Math.ceil(data.length / maxXLabels) : 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND.gradientFrom} />
          <stop offset="100%" stopColor={BRAND.gradientTo} />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines — subtle */}
      {yTicks.map((tick) => (
        <g key={tick.val}>
          <line
            x1={px}
            y1={tick.y}
            x2={px + chartW}
            y2={tick.y}
            stroke="currentColor"
            className="text-gray-100 dark:text-zinc-800/60"
            strokeWidth={0.75}
            strokeDasharray={tick.val === min ? undefined : "4 3"}
          />
          <text
            x={px - 8}
            y={tick.y + 3.5}
            textAnchor="end"
            className="fill-gray-400 dark:fill-zinc-500"
            fontSize={10}
          >
            {tick.val.toFixed(1).replace(".", ",")}
          </text>
        </g>
      ))}

      {/* Gradient fill */}
      {areaD && <path d={areaD} fill="url(#hoursGrad)" />}

      {/* Line */}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke={BRAND.line}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data dots — only show on week/small datasets, skip on large ones */}
      {data.length <= 14 &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={BRAND.dot}
            stroke="white"
            strokeWidth={1.5}
            className="dark:stroke-zinc-900"
          />
        ))}

      {/* First & last dot always visible on larger sets */}
      {data.length > 14 &&
        [0, points.length - 1].map((i) => (
          <circle
            key={i}
            cx={points[i].x}
            cy={points[i].y}
            r={3}
            fill={BRAND.dot}
            stroke="white"
            strokeWidth={1.5}
            className="dark:stroke-zinc-900"
          />
        ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % skip !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={d.date}
            x={points[i].x}
            y={height - 4}
            textAnchor="middle"
            className="fill-gray-400 dark:fill-zinc-500"
            fontSize={10}
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
  avgLabelTemplate,
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
      <CardContent className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5 sm:pb-3">
        {/* Header row: tabs left, date range right */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          {/* Period tabs */}
          <div className="flex gap-0.5 rounded-lg bg-gray-100 dark:bg-zinc-800 p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriod(tab.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === tab.key
                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date range + "Heute" */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
            <span className="tabular-nums">{dateRange}</span>
            <span className="font-medium text-gray-600 dark:text-zinc-300">
              {todayLabel}
            </span>
          </div>
        </div>

        {/* Title + average */}
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {title}
          </h3>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {avgLabelTemplate.replace("{hours}", avgHours)}
          </span>
        </div>

        {/* Chart — consistent inner gutter, proper aspect ratio */}
        <div className="h-52 sm:h-60 -mx-1">
          {data.length > 0 ? (
            <Sparkline data={data} width={720} height={260} />
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
