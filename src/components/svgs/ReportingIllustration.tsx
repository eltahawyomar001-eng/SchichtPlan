"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BarChartIcon } from "@/components/icons/BarChartIcon";

/**
 * Reporting Illustration — Connecteam Step 4.
 *
 * Animated payroll reports with growing bar chart, popping stat boxes,
 * sliding payroll summary, and drawing sparkline trend.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function ReportingIllustration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations("illustrations");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(Math.min(width / 520, 1));
    });
    resizeObserver.observe(el);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          intersectionObserver.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    intersectionObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
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
      style={{ height: 400 * scale }}
      role="img"
      aria-label={t("reportingAria")}
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes rptCardReveal {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes rptHeaderFade {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rptStatPop {
          0% { opacity: 0; transform: scale(0.7); }
          60% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes rptBarGrow {
          0% { width: 0%; opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes rptBarLabel {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes rptOvertimeGrow {
          0% { width: 0%; opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes rptExportFade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rptExportPulse {
          0%, 100% { border-color: rgba(196,181,253,0.5); }
          50% { border-color: rgba(124,58,237,0.4); }
        }
        @keyframes rptPayrollSlide {
          0% { opacity: 0; transform: translateX(30px) scale(0.95); }
          70% { opacity: 1; transform: translateX(-3px) scale(1.01); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes rptPayrollFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes rptSparkSlide {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rptSparkDraw {
          0% { stroke-dashoffset: 200; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes rptSparkFillFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes rptDotPop {
          0% { opacity: 0; r: 0; }
          60% { opacity: 1; r: 4; }
          100% { opacity: 1; r: 3; }
        }
        @keyframes rptCountUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="absolute top-0 left-0 w-[520px] h-[400px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Main report card */}
        <div
          className="absolute left-0 top-0 w-[340px] h-full rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible
              ? "rptCardReveal 0.5s ease-out forwards"
              : "none",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100"
            style={{
              opacity: isVisible ? 1 : 0,
              animation: isVisible
                ? "rptHeaderFade 0.4s ease-out 0.2s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          >
            <div className="flex items-center gap-2">
              <BarChartIcon className="w-5 h-5" />
              <span className="font-semibold text-sm text-gray-800">
                {t("hourReport")}
              </span>
            </div>
            <span className="text-xs text-gray-500">{t("reportWeek")}</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 px-4 py-3">
            {[
              { label: t("total"), value: "155h", accent: "#7C3AED" },
              { label: t("overtime"), value: "2h", accent: "#F59E0B" },
              { label: t("absent"), value: "0", accent: "#10B981" },
            ].map((stat, i) => (
              <StatBox
                key={stat.label}
                label={stat.label}
                value={stat.value}
                accent={stat.accent}
                isVisible={isVisible}
                delay={0.4 + i * 0.1}
              />
            ))}
          </div>

          {/* Horizontal bar chart */}
          <div className="px-4 py-2 space-y-3">
            {employees.map((e, i) => {
              const barWidth = (e.hours / maxHours) * 100;
              const overtimeWidth = (e.overtime / maxHours) * 100;
              const overtimeLeft = ((e.hours - e.overtime) / maxHours) * 100;
              const barDelay = 0.8 + i * 0.15;

              return (
                <div key={e.name} className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium text-gray-600 w-16 shrink-0 truncate"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      animation: isVisible
                        ? `rptBarLabel 0.3s ease-out ${barDelay}s forwards`
                        : "none",
                      animationFillMode: "backwards",
                    }}
                  >
                    {e.name}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg flex items-center pl-2"
                      style={{
                        width: isVisible ? `${barWidth}%` : "0%",
                        backgroundColor: e.color,
                        animation: isVisible
                          ? `rptBarGrow 0.7s ease-out ${barDelay}s forwards`
                          : "none",
                        animationFillMode: "backwards",
                      }}
                    >
                      <span
                        className="text-[10px] text-white font-bold"
                        style={{
                          opacity: isVisible ? 1 : 0,
                          animation: isVisible
                            ? `rptBarLabel 0.3s ease-out ${barDelay + 0.5}s forwards`
                            : "none",
                          animationFillMode: "backwards",
                        }}
                      >
                        {e.hours}h
                      </span>
                    </div>
                    {e.overtime > 0 && (
                      <div
                        className="absolute top-0 h-full bg-amber-400 rounded-r-lg flex items-center justify-center"
                        style={{
                          left: `${overtimeLeft}%`,
                          width: isVisible ? `${overtimeWidth}%` : "0%",
                          animation: isVisible
                            ? `rptOvertimeGrow 0.5s ease-out ${barDelay + 0.4}s forwards`
                            : "none",
                          animationFillMode: "backwards",
                        }}
                      >
                        <span className="text-[9px] text-amber-900 font-bold">
                          +{e.overtime}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export button */}
          <div className="mx-4 mt-3">
            <div
              className="rounded-xl border-2 border-dashed border-violet-200 py-2.5 text-center"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "rptExportFade 0.4s ease-out 1.6s forwards, rptExportPulse 2.5s ease-in-out 2.5s infinite"
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              <span className="text-xs font-semibold text-violet-500 inline-flex items-center gap-1">
                <BarChartIcon className="w-3.5 h-3.5" />
                {t("exportCsv")}
              </span>
            </div>
          </div>
        </div>

        {/* Floating payroll summary */}
        <div
          className="absolute right-0 top-[20px] w-[160px] rounded-xl bg-white border border-gray-100 shadow-[0px_8px_24px_0px_rgba(124,58,237,0.12)] overflow-hidden"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible
              ? "rptPayrollSlide 0.55s ease-out 1.0s forwards, rptPayrollFloat 3s ease-in-out 2.2s infinite"
              : "none",
            animationFillMode: "backwards",
          }}
        >
          <div className="px-4 py-3 bg-gradient-to-br from-violet-600 to-purple-500">
            <span className="block text-[10px] text-violet-200 font-medium">
              {t("laborCosts")}
            </span>
            <span
              className="block text-xl text-white font-bold mt-0.5"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "rptCountUp 0.4s ease-out 1.3s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              €4.820
            </span>
          </div>
          <div className="px-4 py-2.5 space-y-1.5">
            <div
              className="flex justify-between text-[11px]"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "rptBarLabel 0.3s ease-out 1.4s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              <span className="text-gray-500">{t("regular")}</span>
              <span className="text-gray-800 font-medium">€4.700</span>
            </div>
            <div
              className="flex justify-between text-[11px]"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "rptBarLabel 0.3s ease-out 1.55s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              <span className="text-gray-500">{t("overtime")}</span>
              <span className="text-amber-600 font-medium">€120</span>
            </div>
          </div>
        </div>

        {/* Mini sparkline */}
        <div
          className="absolute right-[10px] top-[200px] w-[150px] rounded-xl bg-white border border-gray-100 shadow-[0px_4px_16px_0px_rgba(124,58,237,0.08)] p-3"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible
              ? "rptSparkSlide 0.5s ease-out 1.3s forwards"
              : "none",
            animationFillMode: "backwards",
          }}
        >
          <span className="block text-[10px] text-gray-500 font-medium mb-2">
            {t("hourTrend")}
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
              strokeDasharray="200"
              style={{
                strokeDashoffset: isVisible ? 0 : 200,
                animation: isVisible
                  ? "rptSparkDraw 1.2s ease-out 1.6s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            />
            <path
              d="M0 35 L18 28 L36 30 L54 20 L72 15 L90 18 L108 10 L126 8 L126 40 L0 40 Z"
              fill="url(#sparkline-fill)"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "rptSparkFillFade 0.6s ease-out 2.2s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            />
            <circle
              cx="126"
              cy="8"
              r="3"
              fill="#7C3AED"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "rptDotPop 0.4s ease-out 2.6s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            />
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
  isVisible,
  delay,
}: {
  label: string;
  value: string;
  accent: string;
  isVisible: boolean;
  delay: number;
}) {
  return (
    <div
      className="rounded-xl bg-gray-50 px-3 py-2 text-center border border-gray-100"
      style={{
        opacity: isVisible ? 1 : 0,
        animation: isVisible
          ? `rptStatPop 0.4s ease-out ${delay}s forwards`
          : "none",
        animationFillMode: "backwards",
      }}
    >
      <span className="block text-[10px] text-gray-500 font-medium">
        {label}
      </span>
      <span
        className="block text-lg font-bold mt-0.5"
        style={{
          color: accent,
          opacity: isVisible ? 1 : 0,
          animation: isVisible
            ? `rptCountUp 0.3s ease-out ${delay + 0.15}s forwards`
            : "none",
          animationFillMode: "backwards",
        }}
      >
        {value}
      </span>
    </div>
  );
}
