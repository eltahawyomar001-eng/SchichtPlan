"use client";

import { useRef, useState, useEffect } from "react";
import { BarChartIcon } from "@/components/icons/BarChartIcon";

/**
 * Reporting Illustration — Connecteam Step 4.
 *
 * Shows payroll-ready reports with hours breakdown,
 * bar charts, and export indicators.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function ReportingIllustration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(Math.min(width / 520, 1));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const employees = [
    { name: "Anna M.", hours: 38, overtime: 0, color: "#7C3AED" },
    { name: "Ben K.", hours: 42, overtime: 2, color: "#A78BFA" },
    { name: "Clara S.", hours: 35, overtime: 0, color: "#6D28D9" },
    { name: "David R.", hours: 40, overtime: 0, color: "#C4B5FD" },
  ];

  const maxHours = 42;

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[520px] mx-auto overflow-hidden"
      style={{ height: 320 * scale }}
      role="img"
      aria-label="Berichte — Stundenübersicht und Lohnabrechnung"
    >
      <div
        className="absolute top-0 left-0 w-[520px] h-[320px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Main report card */}
        <div className="absolute left-0 top-0 w-[340px] h-full rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BarChartIcon className="w-5 h-5" />
              <span className="font-semibold text-sm text-gray-800">
                Stundenreport
              </span>
            </div>
            <span className="text-xs text-gray-500">KW 24</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 px-4 py-3">
            <StatBox label="Gesamt" value="155h" accent="#7C3AED" />
            <StatBox label="Überstunden" value="2h" accent="#F59E0B" />
            <StatBox label="Abwesend" value="0" accent="#10B981" />
          </div>

          {/* Horizontal bar chart */}
          <div className="px-4 py-2 space-y-3">
            {employees.map((e) => (
              <div key={e.name} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 w-16 shrink-0 truncate">
                  {e.name}
                </span>
                <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg flex items-center pl-2"
                    style={{
                      width: `${(e.hours / maxHours) * 100}%`,
                      backgroundColor: e.color,
                    }}
                  >
                    <span className="text-[10px] text-white font-bold">
                      {e.hours}h
                    </span>
                  </div>
                  {e.overtime > 0 && (
                    <div
                      className="absolute top-0 h-full bg-amber-400 rounded-r-lg flex items-center justify-center"
                      style={{
                        left: `${((e.hours - e.overtime) / maxHours) * 100}%`,
                        width: `${(e.overtime / maxHours) * 100}%`,
                      }}
                    >
                      <span className="text-[9px] text-amber-900 font-bold">
                        +{e.overtime}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Export button */}
          <div className="mx-4 mt-3">
            <div className="rounded-xl border-2 border-dashed border-violet-200 py-2.5 text-center">
              <span className="text-xs font-semibold text-violet-500">
                📊 Als CSV exportieren
              </span>
            </div>
          </div>
        </div>

        {/* Floating payroll summary */}
        <div className="absolute right-0 top-[20px] w-[160px] rounded-xl bg-white border border-gray-100 shadow-[0px_8px_24px_0px_rgba(124,58,237,0.12)] overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-br from-violet-600 to-purple-500">
            <span className="block text-[10px] text-violet-200 font-medium">
              Lohnkosten
            </span>
            <span className="block text-xl text-white font-bold mt-0.5">
              €4.820
            </span>
          </div>
          <div className="px-4 py-2.5 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Regulär</span>
              <span className="text-gray-800 font-medium">€4.700</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Überstunden</span>
              <span className="text-amber-600 font-medium">€120</span>
            </div>
          </div>
        </div>

        {/* Mini sparkline */}
        <div className="absolute right-[10px] bottom-[40px] w-[150px] rounded-xl bg-white border border-gray-100 shadow-[0px_4px_16px_0px_rgba(124,58,237,0.08)] p-3">
          <span className="block text-[10px] text-gray-500 font-medium mb-2">
            Stundentrend
          </span>
          <svg
            width="126"
            height="40"
            viewBox="0 0 126 40"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 35 L18 28 L36 30 L54 20 L72 15 L90 18 L108 10 L126 8"
              stroke="url(#sparkline-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M0 35 L18 28 L36 30 L54 20 L72 15 L90 18 L108 10 L126 8 L126 40 L0 40 Z"
              fill="url(#sparkline-fill)"
            />
            <circle cx="126" cy="8" r="3" fill="#7C3AED" />
            <defs>
              <linearGradient
                id="sparkline-grad"
                x1="0"
                y1="0"
                x2="126"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#A78BFA" />
                <stop offset="1" stopColor="#7C3AED" />
              </linearGradient>
              <linearGradient
                id="sparkline-fill"
                x1="63"
                y1="0"
                x2="63"
                y2="40"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#7C3AED" stopOpacity="0.15" />
                <stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Stat box helper */
function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2 text-center border border-gray-100">
      <span className="block text-[10px] text-gray-500 font-medium">
        {label}
      </span>
      <span
        className="block text-lg font-bold mt-0.5"
        style={{ color: accent }}
      >
        {value}
      </span>
    </div>
  );
}
