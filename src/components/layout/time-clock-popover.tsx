"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  ClockIcon,
  PlayIcon,
  PauseIcon,
  LogOutIcon,
  AlertTriangleIcon,
} from "@/components/icons";

/* ────────────────────────────────────────────────────────── */
/*  Types                                                     */
/* ────────────────────────────────────────────────────────── */

interface ClockEntry {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  netMinutes: number;
}

interface ArbZGInfo {
  maxDailyMinutes: number;
  todayWorkedMinutes: number;
  remainingMinutes: number;
  warningLevel: "NONE" | "INFO" | "WARNING" | "CRITICAL" | "EXCEEDED";
}

type ClockState = "idle" | "working" | "break";

/* ────────────────────────────────────────────────────────── */
/*  Circular progress ring (SVG)                             */
/* ────────────────────────────────────────────────────────── */

const RING_SIZE = 120;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  progress,
  state,
}: {
  progress: number;
  state: ClockState;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(progress, 1));

  const trackColor =
    state === "idle"
      ? "stroke-gray-200 dark:stroke-zinc-700"
      : "stroke-gray-100 dark:stroke-zinc-800";

  let ringColor = "stroke-emerald-500";
  if (state === "break") ringColor = "stroke-amber-400";
  if (progress >= 0.9) ringColor = "stroke-red-500";

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      className="rotate-[-90deg]"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        className={trackColor}
      />
      {/* Progress arc */}
      {state !== "idle" && (
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={`${ringColor} transition-[stroke-dashoffset] duration-1000 ease-linear`}
        />
      )}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Popover component                                        */
/* ────────────────────────────────────────────────────────── */

export function TimeClockPopover() {
  const t = useTranslations("punchClock");

  /* ── State ── */
  const [open, setOpen] = useState(false);
  const [clockState, setClockState] = useState<ClockState>("idle");
  const [entry, setEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [arbZG, setArbZG] = useState<ArbZGInfo | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [noProfile, setNoProfile] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  /* ── Fetch status from clock API ── */
  const fetchStatus = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(
        `/api/time-entries/clock?timezone=${encodeURIComponent(tz)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.noProfile) {
        setNoProfile(true);
        return;
      }
      setNoProfile(false);
      setEntry(data.entry ?? null);
      setTodayEntries(data.todayEntries ?? []);
      if (data.arbZG) setArbZG(data.arbZG);

      if (data.active && data.onBreak) {
        setClockState("break");
      } else if (data.active) {
        setClockState("working");
      } else {
        setClockState("idle");
      }
      setError("");
    } catch {
      // silent — popover is supplementary
    } finally {
      setInitialLoad(false);
    }
  }, []);

  /* Poll status every 30 s (lightweight — same as notifications) */
  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 30_000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  /* ── Live timer ── */
  useEffect(() => {
    if (
      (clockState === "working" || clockState === "break") &&
      entry?.clockInAt
    ) {
      const update = () => {
        const diff = Date.now() - new Date(entry.clockInAt).getTime();
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setElapsed(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        );
      };
      update();
      timerRef.current = setInterval(update, 1_000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    setElapsed("00:00:00");
  }, [clockState, entry?.clockInAt]);

  /* ── Close on outside click ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!portalRef.current || !portalRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── Perform clock action ── */
  async function handleClock(
    action: "in" | "out" | "break-start" | "break-end",
  ) {
    setActing(true);
    setError("");
    try {
      const res = await fetch("/api/time-entries/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        const errorKey = data.error as string;
        const errorMessages: Record<string, string> = {
          ALREADY_CLOCKED_IN: t("errorAlreadyClockedIn"),
          NOT_CLOCKED_IN: t("errorNotClockedIn"),
          BREAK_ALREADY_ACTIVE: t("errorBreakActive"),
          NO_ACTIVE_BREAK: t("errorNoBreak"),
          NO_EMPLOYEE_PROFILE: t("errorNoProfile"),
          REST_PERIOD_VIOLATION: data.message || t("errorRestPeriod"),
          MAX_DAILY_HOURS_REACHED: data.message || t("errorMaxHours"),
        };
        setError(errorMessages[errorKey] || data.message || t("errorGeneric"));
        return;
      }
      await fetchStatus();
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setActing(false);
    }
  }

  /* ── Derived ── */
  const todayTotalMinutes = todayEntries.reduce(
    (sum, e) => sum + (e.netMinutes || 0),
    0,
  );
  const todayH = Math.floor(todayTotalMinutes / 60);
  const todayM = todayTotalMinutes % 60;

  // Ring progress: fraction of 10h (600 min) ArbZG max
  const workedMinutes = arbZG?.todayWorkedMinutes ?? todayTotalMinutes;
  const maxMinutes = arbZG?.maxDailyMinutes ?? 600;
  const progress = maxMinutes > 0 ? workedMinutes / maxMinutes : 0;

  /* ── Status indicator for trigger button ── */
  const statusDot =
    clockState === "working"
      ? "bg-emerald-500"
      : clockState === "break"
        ? "bg-amber-400"
        : null;

  /* ── ArbZG warning color ── */
  function arbzgColor(level: string) {
    switch (level) {
      case "INFO":
        return "text-blue-600 dark:text-blue-400";
      case "WARNING":
        return "text-amber-600 dark:text-amber-400";
      case "CRITICAL":
      case "EXCEEDED":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-500 dark:text-zinc-400";
    }
  }

  /* ── Shared panel content ── */
  function PanelContent() {
    if (noProfile) {
      return (
        <div className="px-5 py-8 text-center">
          <AlertTriangleIcon className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
            {t("noProfileTitle")}
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            {t("noProfileDesc")}
          </p>
        </div>
      );
    }

    return (
      <div className="px-5 pb-5 pt-4">
        {/* ── Circular timer ── */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <ProgressRing progress={progress} state={clockState} />
            {/* Timer text centred inside ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-zinc-100">
                {clockState === "idle" ? "--:--:--" : elapsed}
              </span>
              <span className="text-[11px] font-medium mt-0.5 text-gray-500 dark:text-zinc-400">
                {clockState === "idle"
                  ? t("inactive")
                  : clockState === "break"
                    ? t("onBreak")
                    : t("working")}
              </span>
            </div>
          </div>
        </div>

        {/* ── ArbZG remaining time ── */}
        {arbZG && clockState !== "idle" && (
          <div className="text-center mb-4">
            <p
              className={`text-xs font-medium ${arbzgColor(arbZG.warningLevel)}`}
            >
              {t("arbzg.workedToday", {
                hours: Math.floor(arbZG.todayWorkedMinutes / 60),
                minutes: arbZG.todayWorkedMinutes % 60,
              })}
              {" · "}
              {Math.floor(arbZG.remainingMinutes / 60)}h{" "}
              {arbZG.remainingMinutes % 60}min {t("arbzg.remainingShort")}
            </p>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="space-y-2">
          {clockState === "idle" && (
            <button
              onClick={() => handleClock("in")}
              disabled={acting}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {acting ? <Spinner /> : <PlayIcon className="h-4.5 w-4.5" />}
              {t("clockIn")}
            </button>
          )}

          {clockState === "working" && (
            <>
              <button
                onClick={() => handleClock("break-start")}
                disabled={acting}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {acting ? <Spinner /> : <PauseIcon className="h-4.5 w-4.5" />}
                {t("startBreak")}
              </button>
              <button
                onClick={() => handleClock("out")}
                disabled={acting}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 shadow-sm hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
              >
                {acting ? <Spinner /> : <LogOutIcon className="h-4.5 w-4.5" />}
                {t("clockOut")}
              </button>
            </>
          )}

          {clockState === "break" && (
            <>
              <button
                onClick={() => handleClock("break-end")}
                disabled={acting}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {acting ? <Spinner /> : <PlayIcon className="h-4.5 w-4.5" />}
                {t("endBreak")}
              </button>
              <button
                onClick={() => handleClock("out")}
                disabled={acting}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 shadow-sm hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
              >
                {acting ? <Spinner /> : <LogOutIcon className="h-4.5 w-4.5" />}
                {t("clockOut")}
              </button>
            </>
          )}
        </div>

        {/* ── Error message ── */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{error}</span>
          </div>
        )}

        {/* ── Today's summary ── */}
        {todayEntries.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                {t("todayLog")}
              </span>
              <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
                {todayH}h {String(todayM).padStart(2, "0")}min
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {todayEntries.slice(0, 3).map((e) => {
                const start = e.clockInAt
                  ? new Date(e.clockInAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--";
                const end = e.clockOutAt
                  ? new Date(e.clockOutAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "…";
                const netH = Math.floor((e.netMinutes || 0) / 60);
                const netM = (e.netMinutes || 0) % 60;
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-400"
                  >
                    <span>
                      {start} – {end}
                    </span>
                    <span className="tabular-nums font-medium">
                      {netH}h {String(netM).padStart(2, "0")}m
                    </span>
                  </div>
                );
              })}
              {todayEntries.length > 3 && (
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center">
                  +{todayEntries.length - 3} {t("todayLog").toLowerCase()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── ArbZG compliance banner ── */}
        {arbZG && arbZG.warningLevel !== "NONE" && clockState !== "idle" && (
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${
              arbZG.warningLevel === "CRITICAL" ||
              arbZG.warningLevel === "EXCEEDED"
                ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                : arbZG.warningLevel === "WARNING"
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                  : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
            }`}
          >
            {t(`arbzg.${arbZG.warningLevel.toLowerCase()}`)}
          </div>
        )}
      </div>
    );
  }

  /* ── Header bar (shared between desktop & mobile) ── */
  function PanelHeader() {
    return (
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 px-5 py-3">
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
          {t("title")}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            clockState === "working"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : clockState === "break"
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              clockState === "working"
                ? "bg-emerald-500 animate-pulse"
                : clockState === "break"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-gray-400 dark:bg-zinc-500"
            }`}
          />
          {clockState === "idle"
            ? t("inactive")
            : clockState === "break"
              ? t("onBreak")
              : t("working")}
        </span>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2.5 sm:p-2 text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300 active:bg-gray-200 dark:active:bg-zinc-700 transition-colors"
        aria-label={t("title")}
      >
        <ClockIcon className="h-5 w-5" />
        {/* Status dot */}
        {statusDot && (
          <span
            className={`absolute top-1 right-1 h-2.5 w-2.5 rounded-full ${statusDot} ring-2 ring-white dark:ring-zinc-900`}
          />
        )}
      </button>

      {/* ── Desktop dropdown ── */}
      {open && (
        <div className="hidden sm:block absolute right-0 top-full mt-2 w-80 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden z-50">
          <PanelHeader />
          {initialLoad ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : (
            <PanelContent />
          )}
        </div>
      )}

      {/* ── Mobile bottom sheet (portal) ── */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={portalRef} className="sm:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <div className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-zinc-600" />
              </div>
              <PanelHeader />
              {initialLoad ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div
                  className="overflow-y-auto"
                  style={{
                    maxHeight: "70svh",
                    paddingBottom: "env(safe-area-inset-bottom)",
                  }}
                >
                  <PanelContent />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ── Tiny spinner ── */
function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-6 w-6 border-[3px]" : "h-4 w-4 border-2";
  return (
    <span
      className={`${dim} animate-spin rounded-full border-current border-t-transparent inline-block`}
      aria-hidden
    />
  );
}
