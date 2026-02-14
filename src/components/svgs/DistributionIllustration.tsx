"use client";

import { useRef, useState, useEffect } from "react";
import { SendIcon } from "@/components/icons/SendIcon";
import { CheckCircleIcon } from "@/components/icons/CheckCircleIcon";

/**
 * Distribution Illustration — Connecteam Step 2.
 *
 * Shows a schedule being dispatched to team members
 * with notification cards and confirmation states.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function DistributionIllustration() {
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

  const teamMembers = [
    { name: "Anna M.", initials: "AM", color: "#7C3AED", status: "confirmed" },
    { name: "Ben K.", initials: "BK", color: "#A78BFA", status: "confirmed" },
    { name: "Clara S.", initials: "CS", color: "#6D28D9", status: "pending" },
    { name: "David R.", initials: "DR", color: "#C4B5FD", status: "pending" },
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[520px] mx-auto overflow-hidden"
      style={{ height: 320 * scale }}
      role="img"
      aria-label="Schichtverteilung — Benachrichtigungen an Teammitglieder"
    >
      <div
        className="absolute top-0 left-0 w-[520px] h-[320px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Main dispatch card */}
        <div className="absolute left-0 top-0 w-[280px] h-full rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100">
            <SendIcon className="w-5 h-5" />
            <span className="font-semibold text-sm text-gray-800">
              Plan verteilen
            </span>
          </div>

          {/* Action button */}
          <div className="px-5 py-4">
            <div className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-center py-3 font-semibold text-sm shadow-lg shadow-violet-200 cursor-pointer">
              An alle senden
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              4 Mitarbeiter erhalten den Plan
            </p>
          </div>

          {/* Team list */}
          <div className="px-4 space-y-2">
            {teamMembers.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gray-50"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initials}
                </div>
                <span className="text-sm font-medium text-gray-700 flex-1">
                  {m.name}
                </span>
                {m.status === "confirmed" ? (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notification cards flying out to the right */}
        <NotificationCard
          name="Anna M."
          initials="AM"
          color="#7C3AED"
          shift="Früh 06:00–14:00"
          top={20}
          left={300}
          opacity={1}
        />
        <NotificationCard
          name="Ben K."
          initials="BK"
          color="#A78BFA"
          shift="Spät 14:00–22:00"
          top={100}
          left={320}
          opacity={0.85}
        />
        <NotificationCard
          name="Clara S."
          initials="CS"
          color="#6D28D9"
          shift="Früh 06:00–14:00"
          top={180}
          left={310}
          opacity={0.65}
        />

        {/* Connecting lines SVG */}
        <svg
          className="absolute left-[270px] top-0 w-[60px] h-[260px]"
          viewBox="0 0 60 260"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 80 C30 80, 30 40, 60 40"
            stroke="url(#dist-line-grad)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <path
            d="M0 120 C30 120, 30 120, 60 120"
            stroke="url(#dist-line-grad)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <path
            d="M0 160 C30 160, 30 200, 60 200"
            stroke="url(#dist-line-grad)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <defs>
            <linearGradient
              id="dist-line-grad"
              x1="0"
              y1="0"
              x2="60"
              y2="260"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#7C3AED" stopOpacity="0.4" />
              <stop offset="1" stopColor="#A78BFA" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

/** Floating notification card helper */
function NotificationCard({
  name,
  initials,
  color,
  shift,
  top,
  left,
  opacity,
}: {
  name: string;
  initials: string;
  color: string;
  shift: string;
  top: number;
  left: number;
  opacity: number;
}) {
  return (
    <div
      className="absolute w-[200px] rounded-xl bg-white border border-gray-100 shadow-[0px_8px_24px_0px_rgba(124,58,237,0.12)] p-3 flex items-center gap-3"
      style={{ top, left, opacity }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-gray-800 truncate">
          {name}
        </span>
        <span className="block text-[10px] text-gray-500 truncate">
          {shift}
        </span>
      </div>
      {/* Bell dot */}
      <div className="relative shrink-0">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9z"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
      </div>
    </div>
  );
}
