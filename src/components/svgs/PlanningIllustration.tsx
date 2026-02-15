"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CalendarIcon } from "@/components/icons/CalendarIcon";
import { ClockIcon } from "@/components/icons/ClockIcon";

/**
 * Planning Illustration — Connecteam Step 1.
 *
 * Animated weekly shift calendar grid with staggered shift blocks,
 * floating drag indicator, and pulsing empty slots.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function PlanningIllustration() {
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

  const days = [
    t("dayMo"),
    t("dayTu"),
    t("dayWe"),
    t("dayTh"),
    t("dayFr"),
    t("daySa"),
    t("daySu"),
  ];
  const shifts = [
    { day: 0, row: 0, color: "#7C3AED", label: t("shiftEarly"), w: 1 },
    { day: 1, row: 0, color: "#7C3AED", label: t("shiftEarly"), w: 1 },
    { day: 2, row: 0, color: "#7C3AED", label: t("shiftEarly"), w: 1 },
    { day: 0, row: 1, color: "#A78BFA", label: t("shiftLate"), w: 1 },
    { day: 1, row: 1, color: "#A78BFA", label: t("shiftLate"), w: 1 },
    { day: 3, row: 0, color: "#6D28D9", label: t("shiftNight"), w: 1 },
    { day: 4, row: 0, color: "#7C3AED", label: t("shiftEarly"), w: 1 },
    { day: 4, row: 1, color: "#A78BFA", label: t("shiftLate"), w: 1 },
    { day: 5, row: 0, color: "#C4B5FD", label: t("shiftStandby"), w: 1 },
  ];

  /** Stagger index for each shift — order they appear in animation */
  let shiftIndex = 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[520px] mx-auto overflow-clip"
      style={{ aspectRatio: "520 / 340", maxHeight: 340 }}
      role="img"
      aria-label={t("planningAria")}
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes shiftSlideIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.92); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dragSlideIn {
          0% { opacity: 0; transform: translateX(20px); }
          70% { opacity: 1; transform: translateX(-3px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes emptyPulse {
          0%, 100% { border-color: #E5E7EB; }
          50% { border-color: #C4B5FD; }
        }
        @keyframes headerFade {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dayHeaderPop {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes cardReveal {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes floatBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

      <div
        className="absolute top-0 left-0 w-[520px] h-[340px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Calendar card */}
        <div
          className="absolute inset-0 rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible ? "cardReveal 0.5s ease-out forwards" : "none",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100"
            style={{
              opacity: isVisible ? 1 : 0,
              animation: isVisible
                ? "headerFade 0.4s ease-out 0.2s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              <span className="font-semibold text-sm text-gray-800">
                {t("calendarWeek")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              <span className="text-xs text-gray-500">{t("hoursTotal")}</span>
            </div>
          </div>

          {/* Day header row */}
          <div className="grid grid-cols-7 gap-px bg-gray-50 border-b border-gray-100">
            {days.map((d, i) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-medium text-gray-500"
                style={{
                  opacity: isVisible ? 1 : 0,
                  animation: isVisible
                    ? `dayHeaderPop 0.3s ease-out ${0.3 + i * 0.05}s forwards`
                    : "none",
                  animationFillMode: "backwards",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Shift grid */}
          <div className="relative p-3">
            <div className="grid grid-cols-7 gap-2" style={{ minHeight: 200 }}>
              {Array.from({ length: 7 }).map((_, colIdx) => {
                const colShifts = shifts.filter((s) => s.day === colIdx);
                return (
                  <div key={colIdx} className="flex flex-col gap-2">
                    {colShifts.map((s, i) => {
                      const idx = shiftIndex++;
                      return (
                        <div
                          key={i}
                          className="rounded-lg px-2 py-2.5 text-white text-xs font-medium shadow-sm"
                          style={{
                            backgroundColor: s.color,
                            opacity: isVisible ? 1 : 0,
                            animation: isVisible
                              ? `shiftSlideIn 0.45s ease-out ${0.5 + idx * 0.08}s forwards`
                              : "none",
                            animationFillMode: "backwards",
                          }}
                        >
                          <span className="block truncate">{s.label}</span>
                          <span className="block text-[10px] opacity-80 mt-0.5">
                            {s.row === 0
                              ? "06-14"
                              : s.row === 1
                                ? "14-22"
                                : "22-06"}
                          </span>
                        </div>
                      );
                    })}
                    {/* Empty slot indicator */}
                    {colShifts.length === 0 && (
                      <div
                        className="rounded-lg border-2 border-dashed border-gray-200 h-14 flex items-center justify-center"
                        style={{
                          opacity: isVisible ? 1 : 0,
                          animation: isVisible
                            ? `shiftSlideIn 0.4s ease-out ${0.5 + colIdx * 0.08}s forwards, emptyPulse 2.5s ease-in-out ${1.5 + colIdx * 0.1}s infinite`
                            : "none",
                          animationFillMode: "backwards",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M8 3v10M3 8h10"
                            stroke="#D1D5DB"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating drag indicator */}
        <div
          className="absolute -right-2 top-[140px] rounded-xl bg-violet-600 text-white px-3 py-2 shadow-lg shadow-violet-200 text-xs font-medium flex items-center gap-1.5"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible
              ? "dragSlideIn 0.5s ease-out 1.4s forwards, floatBounce 3s ease-in-out 2s infinite"
              : "none",
            animationFillMode: "backwards",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 2v10M9 2v10"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {t("drag")}
        </div>
      </div>
    </div>
  );
}
