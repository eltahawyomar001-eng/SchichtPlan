"use client";

import { useRef, useState, useEffect } from "react";
import { CalendarIcon } from "@/components/icons/CalendarIcon";
import { ClockIcon } from "@/components/icons/ClockIcon";

/**
 * Planning Illustration — Connecteam Step 1.
 *
 * Shows a weekly shift calendar grid with shift blocks
 * and drag handles, representing the schedule creation flow.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function PlanningIllustration() {
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

  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const shifts = [
    { day: 0, row: 0, color: "#7C3AED", label: "Früh", w: 1 },
    { day: 1, row: 0, color: "#7C3AED", label: "Früh", w: 1 },
    { day: 2, row: 0, color: "#7C3AED", label: "Früh", w: 1 },
    { day: 0, row: 1, color: "#A78BFA", label: "Spät", w: 1 },
    { day: 1, row: 1, color: "#A78BFA", label: "Spät", w: 1 },
    { day: 3, row: 0, color: "#6D28D9", label: "Nacht", w: 1 },
    { day: 4, row: 0, color: "#7C3AED", label: "Früh", w: 1 },
    { day: 4, row: 1, color: "#A78BFA", label: "Spät", w: 1 },
    { day: 5, row: 0, color: "#C4B5FD", label: "Bereit.", w: 1 },
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[520px] mx-auto overflow-hidden"
      style={{ height: 320 * scale }}
      role="img"
      aria-label="Schichtplanung — Wochenansicht mit Schichtblöcken"
    >
      <div
        className="absolute top-0 left-0 w-[520px] h-[320px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Calendar card */}
        <div className="absolute inset-0 rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              <span className="font-semibold text-sm text-gray-800">
                KW 24 — Jun 2025
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              <span className="text-xs text-gray-500">40 Stunden</span>
            </div>
          </div>

          {/* Day header row */}
          <div className="grid grid-cols-7 gap-px bg-gray-50 border-b border-gray-100">
            {days.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-medium text-gray-500"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Shift grid */}
          <div className="relative p-3">
            <div className="grid grid-cols-7 gap-2" style={{ minHeight: 200 }}>
              {Array.from({ length: 7 }).map((_, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-2">
                  {shifts
                    .filter((s) => s.day === colIdx)
                    .map((s, i) => (
                      <div
                        key={i}
                        className="rounded-lg px-2 py-2.5 text-white text-xs font-medium shadow-sm"
                        style={{ backgroundColor: s.color }}
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
                    ))}
                  {/* Empty slot indicator */}
                  {shifts.filter((s) => s.day === colIdx).length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-gray-200 h-14 flex items-center justify-center">
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
              ))}
            </div>
          </div>
        </div>

        {/* Floating drag indicator */}
        <div className="absolute -right-2 top-[140px] rounded-xl bg-violet-600 text-white px-3 py-2 shadow-lg shadow-violet-200 text-xs font-medium flex items-center gap-1.5">
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
          Verschieben
        </div>
      </div>
    </div>
  );
}
