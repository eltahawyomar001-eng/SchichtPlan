"use client";

import { useRef, useState, useEffect } from "react";
import { SendIcon } from "@/components/icons/SendIcon";
import { CheckCircleIcon } from "@/components/icons/CheckCircleIcon";

/**
 * Distribution Illustration — Connecteam Step 2.
 *
 * Animated dispatch card with team members staggering in,
 * notification cards flying out, and connecting lines drawing.
 * Responsive scaling via ResizeObserver, matching Slide architecture.
 */
export function DistributionIllustration() {
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
      {/* Inline keyframes */}
      <style>{`
        @keyframes distCardReveal {
          0% { opacity: 0; transform: translateX(-20px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes distHeaderFade {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes distButtonPulse {
          0% { opacity: 0; transform: scale(0.9); }
          60% { opacity: 1; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes distButtonGlow {
          0%, 100% { box-shadow: 0 4px 14px rgba(124,58,237,0.3); }
          50% { box-shadow: 0 4px 24px rgba(124,58,237,0.5); }
        }
        @keyframes distMemberSlide {
          0% { opacity: 0; transform: translateX(-16px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes distNotifFly {
          0% { opacity: 0; transform: translateX(-40px) scale(0.85); }
          70% { opacity: 1; transform: translateX(4px) scale(1.02); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes distNotifFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes distLineDraw {
          0% { stroke-dashoffset: 60; opacity: 0; }
          30% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes distBellRing {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(12deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(6deg); }
          80% { transform: rotate(-4deg); }
        }
        @keyframes distCheckPop {
          0% { opacity: 0; transform: scale(0); }
          60% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        className="absolute top-0 left-0 w-[520px] h-[320px] origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Main dispatch card */}
        <div
          className="absolute left-0 top-0 w-[280px] h-full rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(124,58,237,0.08),0px_1px_3px_0px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden"
          style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible
              ? "distCardReveal 0.5s ease-out forwards"
              : "none",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100"
            style={{
              opacity: isVisible ? 1 : 0,
              animation: isVisible
                ? "distHeaderFade 0.4s ease-out 0.2s forwards"
                : "none",
              animationFillMode: "backwards",
            }}
          >
            <SendIcon className="w-5 h-5" />
            <span className="font-semibold text-sm text-gray-800">
              Plan verteilen
            </span>
          </div>

          {/* Action button */}
          <div className="px-5 py-4">
            <div
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-center py-3 font-semibold text-sm shadow-lg shadow-violet-200 cursor-pointer"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "distButtonPulse 0.5s ease-out 0.4s forwards, distButtonGlow 2.5s ease-in-out 1.8s infinite"
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              An alle senden
            </div>
            <p
              className="text-xs text-gray-400 text-center mt-2"
              style={{
                opacity: isVisible ? 1 : 0,
                animation: isVisible
                  ? "distHeaderFade 0.3s ease-out 0.6s forwards"
                  : "none",
                animationFillMode: "backwards",
              }}
            >
              4 Mitarbeiter erhalten den Plan
            </p>
          </div>

          {/* Team list */}
          <div className="px-4 space-y-2">
            {teamMembers.map((m, i) => (
              <div
                key={m.name}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gray-50"
                style={{
                  opacity: isVisible ? 1 : 0,
                  animation: isVisible
                    ? `distMemberSlide 0.4s ease-out ${0.7 + i * 0.1}s forwards`
                    : "none",
                  animationFillMode: "backwards",
                }}
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
                  <div
                    style={{
                      opacity: isVisible ? 1 : 0,
                      animation: isVisible
                        ? `distCheckPop 0.4s ease-out ${1.3 + i * 0.15}s forwards`
                        : "none",
                      animationFillMode: "backwards",
                    }}
                  >
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                  </div>
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
          index={0}
          isVisible={isVisible}
        />
        <NotificationCard
          name="Ben K."
          initials="BK"
          color="#A78BFA"
          shift="Spät 14:00–22:00"
          top={100}
          left={320}
          index={1}
          isVisible={isVisible}
        />
        <NotificationCard
          name="Clara S."
          initials="CS"
          color="#6D28D9"
          shift="Früh 06:00–14:00"
          top={180}
          left={310}
          index={2}
          isVisible={isVisible}
        />

        {/* Connecting lines SVG */}
        <svg
          className="absolute left-[270px] top-0 w-[60px] h-[260px]"
          viewBox="0 0 60 260"
          fill="none"
          aria-hidden="true"
        >
          {[
            "M0 80 C30 80, 30 40, 60 40",
            "M0 120 C30 120, 30 120, 60 120",
            "M0 160 C30 160, 30 200, 60 200",
          ].map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="url(#dist-line-grad)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              style={{
                opacity: isVisible ? 1 : 0,
                strokeDashoffset: isVisible ? 0 : 60,
                animation: isVisible
                  ? `distLineDraw 0.6s ease-out ${1.1 + i * 0.15}s forwards`
                  : "none",
                animationFillMode: "backwards",
              }}
            />
          ))}
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
  index,
  isVisible,
}: {
  name: string;
  initials: string;
  color: string;
  shift: string;
  top: number;
  left: number;
  index: number;
  isVisible: boolean;
}) {
  const baseDelay = 1.2 + index * 0.2;
  const floatDelay = 2.2 + index * 0.3;
  const bellDelay = 1.8 + index * 0.25;
  const targetOpacity = 1 - index * 0.15;

  return (
    <div
      className="absolute w-[200px] rounded-xl bg-white border border-gray-100 shadow-[0px_8px_24px_0px_rgba(124,58,237,0.12)] p-3 flex items-center gap-3"
      style={{
        top,
        left,
        opacity: isVisible ? targetOpacity : 0,
        animation: isVisible
          ? `distNotifFly 0.55s ease-out ${baseDelay}s forwards, distNotifFloat 3s ease-in-out ${floatDelay}s infinite`
          : "none",
        animationFillMode: "backwards",
      }}
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
          style={{
            transformOrigin: "top center",
            animation: isVisible
              ? `distBellRing 0.6s ease-in-out ${bellDelay}s`
              : "none",
          }}
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
