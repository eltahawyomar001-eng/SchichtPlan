"use client";

import { useRef, useState, useEffect } from "react";
import { UsersIcon } from "@/components/icons/UsersIcon";
import { ClockIcon } from "@/components/icons/ClockIcon";
import { CheckCircleIcon } from "@/components/icons/CheckCircleIcon";

/**
 * Day-to-Day Illustration — Connecteam Step 3.
 *
 * Animated live dashboard with staggered shift rows, pulsing live dot,
 * filling progress bar, and activity feed cards sliding in.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function DayToDayIllustration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

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

  const activeShifts = [
    { name: "Anna M.", role: "Barista", since: "06:02", status: "active" },
    { name: "Ben K.", role: "Kellner", since: "06:15", status: "active" },
    { name: "Clara S.", role: "Küche", since: "—", status: "late" },
  ];

  const activities = [
    { text: "Anna hat eingecheckt", time: "06:02", type: "checkin" },
    { text: "Ben hat eingecheckt", time: "06:15", type: "checkin" },
    { text: "Tausch: Clara ↔ David", time: "05:45", type: "swap" },
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[520px] mx-auto overflow-hidden"
      style={{ height: 320 * scale }}
      role="img"
      aria-label="Tagesmanagement — Live-Dashboard mit aktiven Schichten"
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes dayCardReveal {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes dayHeaderFade {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dayLivePulse {
          0% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.4); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes dayLiveBeat {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
        @keyframes dayShiftSlide {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dayStatusDot {
          0% { opacity: 0; transform: scale(0); }
          60% { transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes dayBarFill {
          0% { width: 0%; }
          100% { width: 66%; }
        }
        @keyframes daySummaryFade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dayFeedSlide {
          0% { opacity: 0; transform: translateX(30px); }
          70% { opacity: 1; transform: translateX(-2px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes dayDotFade {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes dayConnectDraw {
          0% { stroke-dashoffset: 80; opacity: 0; }
          30% { opacity: 0.15; }
          100% { stroke-dashoffset: 0; opacity: 0.15; }
        }
      `}</style>

      <div
        className="absolute top-0 left-0 w-[520px] h-[320px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Active shifts panel */}
        <div
          className="absolute left-0 top-0 w-[300px] h-full rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible
              ? "dayCardReveal 0.5s ease-out forwards"
              : "none",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100"
            style={{
              opacity: isVisible ? 1 : 0,
              animation: isVisible
                ? "dayHeaderFade 0.4s ease-out 0.2s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          >
            <div className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5" />
              <span className="font-semibold text-sm text-gray-800">
                Heute aktiv
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full bg-emerald-500"
                style={{
                  opacity: isVisible ? 1 : 0,
                  animation: isVisible
                    ? "dayLivePulse 0.4s ease-out 0.5s forwards, dayLiveBeat 2s ease-in-out 1.5s infinite"
                    : "none",
                  animationFillMode: "backwards",
                }}
              />
              <span className="text-xs text-emerald-600 font-medium">Live</span>
            </div>
          </div>

          {/* Shift rows */}
          <div className="px-4 py-3 space-y-2">
            {activeShifts.map((s, i) => (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gray-50 border border-gray-100"
                style={{
                  opacity: isVisible ? 1 : 0,
                  animation: isVisible
                    ? `dayShiftSlide 0.4s ease-out ${0.5 + i * 0.12}s forwards`
                    : "none",
                  animationFillMode: "backwards",
                }}
              >
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {s.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      s.status === "active" ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                    style={{
                      opacity: isVisible ? 1 : 0,
                      animation: isVisible
                        ? `dayStatusDot 0.3s ease-out ${0.8 + i * 0.12}s forwards`
                        : "none",
                      animationFillMode: "backwards",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">
                    {s.name}
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    {s.role}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span className="text-xs text-gray-600 font-medium">
                      {s.since}
                    </span>
                  </div>
                  {s.status === "late" && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Verspätet
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary bar */}
          <div
            className="mx-4 px-3 py-2 rounded-lg bg-violet-50 flex items-center justify-between"
            style={{
              opacity: isVisible ? 1 : 0,
              animation: isVisible
                ? "daySummaryFade 0.4s ease-out 1.1s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          >
            <span className="text-xs text-violet-700 font-medium">
              2/3 eingecheckt
            </span>
            <div className="w-20 h-1.5 rounded-full bg-violet-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{
                  width: isVisible ? "66%" : "0%",
                  animation: isVisible
                    ? "dayBarFill 0.8s ease-out 1.3s forwards"
                    : "none",
                  animationFillMode: "backwards",
                }}
              />
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="absolute right-0 top-[10px] w-[200px] space-y-3">
          {activities.map((a, i) => (
            <div
              key={i}
              className="rounded-xl bg-white border border-gray-100 shadow-[0px_4px_16px_0px_rgba(124,58,237,0.08)] px-3 py-2.5"
              style={{
                opacity: isVisible ? 1 - i * 0.15 : 0,
                animation: isVisible
                  ? `dayFeedSlide 0.5s ease-out ${1.0 + i * 0.18}s forwards`
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs font-medium text-gray-800">
                    {a.text}
                  </span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    {a.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Connecting dots */}
        <svg
          className="absolute left-[295px] top-[40px] w-[30px] h-[240px]"
          viewBox="0 0 30 240"
          fill="none"
          aria-hidden="true"
        >
          {[
            { cx: 5, cy: 40, r: 3, opacity: 0.3 },
            { cx: 15, cy: 120, r: 3, opacity: 0.2 },
            { cx: 10, cy: 200, r: 3, opacity: 0.15 },
          ].map((dot, i) => (
            <circle
              key={i}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill="#7C3AED"
              fillOpacity={dot.opacity}
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? `dayDotFade 0.3s ease-out ${1.3 + i * 0.2}s forwards`
                  : "none",
                animationFillMode: "backwards",
              }}
            />
          ))}
          <path
            d="M5 43 C10 80, 15 80, 15 117"
            stroke="#7C3AED"
            strokeWidth="1"
            strokeDasharray="3 3"
            style={{
              opacity: isVisible ? 0.15 : 0,
              strokeDashoffset: isVisible ? 0 : 80,
              animation: isVisible
                ? "dayConnectDraw 0.6s ease-out 1.5s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          />
          <path
            d="M15 123 C12 160, 10 160, 10 197"
            stroke="#7C3AED"
            strokeWidth="1"
            strokeDasharray="3 3"
            style={{
              opacity: isVisible ? 0.1 : 0,
              strokeDashoffset: isVisible ? 0 : 80,
              animation: isVisible
                ? "dayConnectDraw 0.6s ease-out 1.7s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          />
        </svg>
      </div>
    </div>
  );
}
