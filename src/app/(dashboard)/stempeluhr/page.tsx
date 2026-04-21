"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import {
  ClockIcon,
  AlertTriangleIcon,
  UsersIcon,
  PlayIcon,
  LogOutIcon,
  CheckCircleIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";
import { haptics } from "@/lib/haptics";

interface ClockEntry {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  breakMinutes: number;
  grossMinutes: number;
  netMinutes: number;
}

interface TeamEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  position: string | null;
}

interface TeamMember {
  employee: TeamEmployee;
  status: "offline" | "working" | "break";
  active: {
    id: string;
    clockInAt: string;
    startTime: string;
    breakStart: string | null;
    breakEnd: string | null;
  } | null;
  completedCount: number;
  totalNetMinutes: number;
}

interface TeamSummary {
  total: number;
  working: number;
  onBreak: number;
  offline: number;
}

interface ArbZGInfo {
  maxDailyMinutes: number;
  todayWorkedMinutes: number;
  remainingMinutes: number;
  warningLevel: "NONE" | "INFO" | "WARNING" | "CRITICAL" | "EXCEEDED";
}

type ClockState = "idle" | "working" | "break";

export default function StempeluhrSeite() {
  const { data: session } = useSession();
  const t = useTranslations("punchClock");
  const locale = useLocale();
  const user = session?.user as SessionUser | undefined;

  const [clockState, setClockState] = useState<ClockState>("idle");
  const [entry, setEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const [breakElapsed, setBreakElapsed] = useState("");
  const [breakElapsedMin, setBreakElapsedMin] = useState(0);
  const [breakStartAt, setBreakStartAt] = useState<string | null>(null);
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState<number>(30);
  const [lastBreakMinutes, setLastBreakMinutes] = useState<number | null>(null);
  const [lastBreakRange, setLastBreakRange] = useState<{
    from: string;
    to: string;
    minutes: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [noProfile, setNoProfile] = useState(false);
  const [arbZG, setArbZG] = useState<ArbZGInfo | null>(null);
  const [autoClockOutDone, setAutoClockOutDone] = useState(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const autoClockOutRef = useRef(false);
  // Fire each break-notification only once per break session
  const break5MinNotifiedRef = useRef(false);
  const breakEndNotifiedRef = useRef(false);

  // ── Team state (management only) ──
  const isManager = ["OWNER", "ADMIN", "MANAGER"].includes(user?.role ?? "");
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  // ── Fetch team status ──
  const fetchTeam = useCallback(async () => {
    if (!isManager) return;
    setTeamLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(
        `/api/time-entries/clock/team?timezone=${encodeURIComponent(tz)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTeamData(data.team || []);
        setTeamSummary(data.summary || null);
      }
    } catch {
      // silent – team panel is supplementary
    } finally {
      setTeamLoading(false);
    }
  }, [isManager]);

  // ── Fetch current status ──
  const fetchStatus = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(
        `/api/time-entries/clock?timezone=${encodeURIComponent(tz)}`,
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("errorGeneric"));
        return;
      }
      const data = await res.json();
      if (data.noProfile) {
        setNoProfile(true);
        return;
      }
      setEntry(data.entry);
      setTodayEntries(data.todayEntries || []);

      // Compute breakStartAt CLIENT-SIDE to avoid server timezone mismatch.
      // breakStart is stored as "HH:MM" in the user's LOCAL timezone (generated
      // via toLocaleTimeString on the server with the user's tz param).
      // d.setHours() on the client also uses local timezone → they match.
      // On Vercel (UTC), d.setHours() would produce the wrong epoch.
      if (
        data.entry?.breakStart &&
        !data.entry?.breakEnd &&
        data.entry?.clockInAt
      ) {
        const [bh, bm] = (data.entry.breakStart as string)
          .split(":")
          .map(Number);
        const d = new Date(data.entry.clockInAt as string);
        d.setHours(bh, bm, 0, 0);
        // Midnight crossover: if break time is before clock-in, it's next day
        if (d.getTime() < new Date(data.entry.clockInAt as string).getTime()) {
          d.setDate(d.getDate() + 1);
        }
        setBreakStartAt(d.toISOString());
      } else {
        setBreakStartAt(null);
      }

      if (typeof data.defaultBreakMinutes === "number") {
        setDefaultBreakMinutes(data.defaultBreakMinutes);
      }
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
      setError(t("errorNetwork"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Fetch team data (management) ──
  useEffect(() => {
    fetchTeam();
    // Auto-refresh every 30s
    if (isManager) {
      const iv = setInterval(fetchTeam, 30000);
      return () => clearInterval(iv);
    }
  }, [fetchTeam, isManager]);

  // ── Check GPS permission ──
  // GPS collection disabled — removed for legal compliance (§87 BetrVG)

  // ── Live timer + periodic ArbZG refresh + client-side auto-checkout ──
  useEffect(() => {
    if (
      (clockState === "working" || clockState === "break") &&
      entry?.clockInAt
    ) {
      // Previous completed minutes today (from last server fetch)
      const prevCompletedMinutes = arbZG
        ? arbZG.todayWorkedMinutes -
          Math.round((Date.now() - new Date(entry.clockInAt).getTime()) / 60000)
        : 0;
      const maxDailyMin = arbZG?.maxDailyMinutes ?? 600; // ArbZG §3: 10h

      const update = () => {
        const diff = Date.now() - new Date(entry.clockInAt).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        );

        // ArbZG §3: Client-side auto-checkout when daily limit reached.
        // This fires immediately when the timer crosses 10h, instead of
        // waiting for the next server poll (which can lag up to 5 minutes).
        const currentSessionMin = Math.round(diff / 60000);
        const totalTodayMin =
          Math.max(0, prevCompletedMinutes) + currentSessionMin;
        if (
          totalTodayMin >= maxDailyMin &&
          !autoClockOutRef.current &&
          !acting
        ) {
          autoClockOutRef.current = true;
          setAutoClockOutDone(true);
          handleClock("out");
        }
      };
      update();
      timerRef.current = setInterval(update, 1000);

      // Re-fetch status every 5 minutes to get updated ArbZG info
      // (warnings, remaining time); more often when near the limit
      const refreshInterval =
        arbZG && arbZG.remainingMinutes <= 30 ? 60000 : 300000;
      const arbzgRefresh = setInterval(fetchStatus, refreshInterval);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        clearInterval(arbzgRefresh);
      };
    } else {
      setElapsed("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockState, entry?.clockInAt, arbZG?.warningLevel, acting]);

  // ── Break-countdown timer (counts DOWN from target, then overruns) ──
  useEffect(() => {
    if (clockState !== "break" || !breakStartAt) {
      setBreakElapsed("");
      setBreakElapsedMin(0);
      return;
    }
    // Reset notification guards for a fresh break session
    break5MinNotifiedRef.current = false;
    breakEndNotifiedRef.current = false;

    const startMs = new Date(breakStartAt).getTime();
    const targetMs = Math.max(1, defaultBreakMinutes) * 60_000;

    const fireNotification = (title: string, body: string) => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification(title, {
          body,
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
          tag: "shiftfy-break",
          requireInteraction: false,
        });
      } catch {
        /* noop — some browsers throw when constructing */
      }
    };

    const tick = () => {
      const elapsedMs = Math.max(0, Date.now() - startMs);
      const remainingMs = targetMs - elapsedMs;
      setBreakElapsedMin(Math.floor(elapsedMs / 60000));

      if (remainingMs > 0) {
        // Count-down display (MM:SS of time remaining)
        const m = Math.floor(remainingMs / 60000);
        const s = Math.floor((remainingMs % 60000) / 1000);
        setBreakElapsed(
          `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        );

        // 5-minute warning (fire once when crossing the 5-min threshold)
        const remainingSec = Math.ceil(remainingMs / 1000);
        if (
          remainingSec <= 300 &&
          remainingSec > 295 &&
          !break5MinNotifiedRef.current
        ) {
          break5MinNotifiedRef.current = true;
          fireNotification(
            t("breakEndingSoonTitle"),
            t("breakEndingSoonBody", { minutes: 5 }),
          );
          haptics.medium();
        }
      } else {
        // Overrun — clamp display at 00:00 (the red "X min over target" badge handles the overrun copy)
        setBreakElapsed("00:00");

        if (!breakEndNotifiedRef.current) {
          breakEndNotifiedRef.current = true;
          fireNotification(
            t("breakEndedNotifTitle"),
            t("breakEndedNotifBody", { minutes: defaultBreakMinutes }),
          );
          haptics.success();
        }
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockState, breakStartAt, defaultBreakMinutes]);

  // ── Capture last completed break duration when transitioning break → working ──
  const prevClockStateRef = useRef<ClockState>("idle");
  const breakStartHHMMRef = useRef<string | null>(null);
  // Remember the HH:MM the user went on break (so we can show the full range when it ends)
  useEffect(() => {
    if (clockState === "break" && entry?.breakStart) {
      breakStartHHMMRef.current = entry.breakStart;
    }
  }, [clockState, entry?.breakStart]);

  useEffect(() => {
    if (prevClockStateRef.current === "break" && clockState === "working") {
      // Compute THIS break's duration locally from the remembered breakStart
      // HH:MM — breakElapsedMin may have been reset by the other effect, and
      // entry.breakMinutes is now a CUMULATIVE total across all breaks of the
      // shift (we must not show the running total here).
      const from = breakStartHHMMRef.current ?? entry?.breakStart ?? null;
      let minutes = 0;
      if (from) {
        const [bh, bm] = from.split(":").map(Number);
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const startMin = bh * 60 + bm;
        minutes = Math.max(0, nowMin - startMin);
      } else {
        minutes = breakElapsedMin;
      }

      if (minutes > 0) {
        setLastBreakMinutes(minutes);

        // Build "HH:MM–HH:MM" range for display
        if (from) {
          const now = new Date();
          const to = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          setLastBreakRange({ from, to, minutes });
        } else {
          setLastBreakRange(null);
        }

        // Clear the remembered start so a subsequent break gets a fresh window
        breakStartHHMMRef.current = null;
      }
    }
    prevClockStateRef.current = clockState;
  }, [clockState, entry?.breakStart, breakElapsedMin]);

  // ── ArbZG §3: Auto clock-out when server reports EXCEEDED ──
  // (Fallback: also triggers on server-side arbZG state updates)
  useEffect(() => {
    if (
      arbZG?.warningLevel === "EXCEEDED" &&
      (clockState === "working" || clockState === "break") &&
      !autoClockOutRef.current &&
      !acting
    ) {
      autoClockOutRef.current = true;
      setAutoClockOutDone(true);
      handleClock("out");
    }
    // Reset the guard when the user is idle (allows re-trigger on next shift)
    if (clockState === "idle") {
      autoClockOutRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbZG?.warningLevel, clockState, acting]);

  // ── Perform action ──
  async function handleClock(
    action: "in" | "out" | "break-start" | "break-end",
  ) {
    setActing(true);
    setError("");

    // Request browser notification permission when the user starts a break.
    // This is the natural moment of intent — we never auto-prompt on load.
    if (
      action === "break-start" &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        /* noop — user may have blocked, that's fine */
      }
    }

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
      await fetchTeam();
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setActing(false);
    }
  }

  // ── Today's total ──
  const todayTotalMinutes = todayEntries.reduce(
    (sum, e) => sum + (e.netMinutes || 0),
    0,
  );
  const todayHours = Math.floor(todayTotalMinutes / 60);
  const todayMins = todayTotalMinutes % 60;

  // ── No-profile state ──
  if (noProfile) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <PageContent>
          <div className="mx-auto max-w-md">
            <Card>
              <CardContent className="p-8 sm:p-8 text-center">
                <AlertTriangleIcon className="mx-auto mb-4 h-12 w-12 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {t("noProfileTitle")}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {t("noProfileDesc")}
                </p>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={async () => {
                      setActing(true);
                      setError("");
                      try {
                        const res = await fetch(
                          "/api/time-entries/clock/create-profile",
                          { method: "POST" },
                        );
                        if (res.ok) {
                          // Profile created — reload the page so the session
                          // picks up the new employeeId
                          window.location.reload();
                        } else {
                          const data = await res.json();
                          setError(data.error || t("errorGeneric"));
                        }
                      } catch {
                        setError(t("errorNetwork"));
                      } finally {
                        setActing(false);
                      }
                    }}
                    disabled={acting}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {acting ? <Spinner /> : <ClockIcon className="h-4 w-4" />}
                    {t("createProfile")}
                  </button>
                  <Link
                    href="/mitarbeiter"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <UsersIcon className="h-4 w-4" />
                    {t("goToEmployees")}
                  </Link>
                </div>
                {error && (
                  <div className="mt-4 flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-[15px] font-medium text-red-700">
                    <AlertTriangleIcon className="h-5 w-5 shrink-0" />
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </PageContent>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent className="pb-bottom-action lg:pb-0">
        <div className="mx-auto max-w-md space-y-4">
          {/* ── Error banner ── */}
          {error && (
            <div className="flex items-center gap-2 rounded-[14px] bg-red-50 dark:bg-red-950/40 px-4 py-3 text-[15px] font-medium text-red-700 dark:text-red-300">
              <AlertTriangleIcon className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Auto clock-out notification ── */}
          {autoClockOutDone && clockState === "idle" && (
            <div className="flex items-start gap-3 rounded-[14px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-[14px] font-medium text-red-700 dark:text-red-300">
              <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{t("arbzg.autoClockOut")}</p>
                <p className="mt-0.5 text-[13px] opacity-80">
                  {t("arbzg.autoClockOutDesc")}
                </p>
              </div>
            </div>
          )}

          {/* ── ArbZG compliance warning ── */}
          {arbZG && arbZG.warningLevel !== "NONE" && clockState !== "idle" && (
            <div
              className={`flex items-start gap-3 rounded-[14px] px-4 py-3 text-[14px] font-medium ${
                arbZG.warningLevel === "EXCEEDED"
                  ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50"
                  : arbZG.warningLevel === "CRITICAL"
                    ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 animate-pulse"
                    : arbZG.warningLevel === "WARNING"
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              }`}
            >
              <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {arbZG.warningLevel === "EXCEEDED"
                    ? t("arbzg.exceeded")
                    : arbZG.warningLevel === "CRITICAL"
                      ? t("arbzg.critical")
                      : arbZG.warningLevel === "WARNING"
                        ? t("arbzg.warning")
                        : t("arbzg.info")}
                </p>
                <p className="mt-0.5 text-[13px] opacity-80">
                  {t("arbzg.workedToday", {
                    hours: Math.floor(arbZG.todayWorkedMinutes / 60),
                    minutes: arbZG.todayWorkedMinutes % 60,
                  })}{" "}
                  ·{" "}
                  {t("arbzg.remaining", {
                    hours: Math.floor(arbZG.remainingMinutes / 60),
                    minutes: arbZG.remainingMinutes % 60,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* ── Main clock card ── */}
          <div
            className={`relative overflow-hidden rounded-2xl transition-all duration-500 ${
              clockState === "working"
                ? "bg-gradient-to-b from-emerald-50 to-white shadow-[0_2px_20px_-4px_rgba(5,150,105,0.2)]"
                : clockState === "break"
                  ? "bg-gradient-to-b from-amber-50 to-white shadow-[0_2px_20px_-4px_rgba(217,119,6,0.2)]"
                  : "bg-white dark:bg-zinc-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.08)]"
            }`}
          >
            <div className="px-6 pb-7 pt-6">
              {/* User + status row */}
              <div className="mb-6 flex items-center justify-between">
                {user?.name && (
                  <p className="text-sm font-medium text-gray-500">
                    {user.name}
                  </p>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${
                    clockState === "working"
                      ? "bg-emerald-100 text-emerald-700"
                      : clockState === "break"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      clockState === "working"
                        ? "bg-emerald-500 animate-pulse"
                        : clockState === "break"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-gray-400"
                    }`}
                  />
                  {clockState === "working"
                    ? t("working")
                    : clockState === "break"
                      ? t("onBreak")
                      : t("inactive")}
                </span>
              </div>

              {/* ── Timer display ── */}
              {clockState !== "idle" ? (
                <div className="mb-6 text-center">
                  {clockState === "break" ? (
                    /* Break mode: show break-elapsed timer + countdown */
                    <>
                      <div className="inline-flex items-center gap-1 rounded-2xl px-5 py-4 transition-all duration-500 bg-amber-500/[0.08]">
                        {(breakElapsed || "00:00")
                          .split(":")
                          .map((segment, i, arr) => (
                            <span key={i} className="flex items-center">
                              {i > 0 && (
                                <span className="mx-0.5 mb-1.5 text-3xl font-light select-none text-amber-400">
                                  :
                                </span>
                              )}
                              <span
                                className={`inline-block min-w-[2.8rem] rounded-xl px-1 py-0.5 text-center font-mono text-4xl font-bold tabular-nums tracking-tight text-amber-700 ${
                                  arr.length === 3 && i === 2
                                    ? "opacity-70 text-3xl"
                                    : ""
                                }`}
                              >
                                {segment}
                              </span>
                            </span>
                          ))}
                      </div>

                      {/* Countdown / overrun */}
                      <div className="mt-3">
                        {(() => {
                          const target = defaultBreakMinutes;
                          const remain = target - breakElapsedMin;
                          if (remain >= 0) {
                            return (
                              <p className="text-sm font-medium text-amber-700">
                                {t("breakRemaining", {
                                  minutes: remain,
                                  target,
                                })}
                              </p>
                            );
                          }
                          return (
                            <p className="text-sm font-semibold text-red-600 animate-pulse">
                              {t("breakOverrun", {
                                minutes: -remain,
                                target,
                              })}
                            </p>
                          );
                        })()}
                      </div>

                      {/* Mini progress bar */}
                      <div className="mx-auto mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-amber-100">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            breakElapsedMin > defaultBreakMinutes
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (breakElapsedMin / Math.max(1, defaultBreakMinutes)) * 100)}%`,
                          }}
                        />
                      </div>

                      {entry?.breakStart && (
                        <p className="mt-2.5 text-xs text-gray-400 tracking-wide">
                          {t("breakSince")}{" "}
                          <span className="font-medium text-gray-500">
                            {entry.breakStart}
                          </span>
                        </p>
                      )}
                    </>
                  ) : (
                    /* Working mode: existing session timer */
                    <>
                      <div
                        className={`inline-flex items-center gap-1 rounded-2xl px-5 py-4 transition-all duration-500 ${
                          clockState === "working"
                            ? "bg-emerald-600/[0.06]"
                            : "bg-amber-500/[0.08]"
                        }`}
                      >
                        {elapsed.split(":").map((segment, i) => (
                          <span key={i} className="flex items-center">
                            {i > 0 && (
                              <span
                                className={`mx-0.5 mb-1.5 text-3xl font-light select-none ${
                                  clockState === "working"
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }`}
                              >
                                :
                              </span>
                            )}
                            <span
                              className={`inline-block min-w-[2.8rem] rounded-xl px-1 py-0.5 text-center font-mono text-4xl font-bold tabular-nums tracking-tight ${
                                clockState === "working"
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              } ${i === 2 ? "opacity-70 text-3xl" : ""}`}
                            >
                              {segment}
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Last break pill (visible briefly after ending pause) */}
                      {lastBreakMinutes !== null && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 animate-in fade-in slide-in-from-top-1 duration-300">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          {lastBreakRange
                            ? t("lastBreakRange", lastBreakRange)
                            : t("lastBreak", { minutes: lastBreakMinutes })}
                        </div>
                      )}

                      {/* Clock-in time subtitle */}
                      {entry?.clockInAt && (
                        <p className="mt-2.5 text-xs text-gray-400 tracking-wide">
                          {t("active")}{" "}
                          <span className="font-medium text-gray-500">
                            {new Date(entry.clockInAt).toLocaleTimeString(
                              locale === "en" ? "en-GB" : "de-DE",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Idle state — large clock icon */
                <div className="mb-6 flex flex-col items-center gap-3">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#f2f2f7]">
                    <ClockIcon className="h-12 w-12 text-[#c7c7cc]" />
                  </div>
                  <p className="text-[15px] text-[#8e8e93]">{t("inactive")}</p>
                </div>
              )}

              {/* ── Today progress bar (when active) ── */}
              {clockState !== "idle" && todayTotalMinutes > 0 && (
                <div className="mb-5">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>{t("todayLog")}</span>
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      {todayHours}h {String(todayMins).padStart(2, "0")}m
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        arbZG && arbZG.warningLevel === "CRITICAL"
                          ? "bg-red-500"
                          : arbZG && arbZG.warningLevel === "WARNING"
                            ? "bg-amber-500"
                            : clockState === "working"
                              ? "bg-emerald-500"
                              : "bg-amber-400"
                      }`}
                      style={{
                        width: `${Math.min(100, (todayTotalMinutes / (arbZG?.maxDailyMinutes ?? 600)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-300 dark:text-gray-600">
                    <span>
                      {arbZG
                        ? `${Math.floor(arbZG.remainingMinutes / 60)}h ${arbZG.remainingMinutes % 60}m ${t("arbzg.remainingShort")}`
                        : ""}
                    </span>
                    <span>/ 10h (ArbZG)</span>
                  </div>
                </div>
              )}

              {/* ── Action buttons — hidden on mobile (sticky bar handles it) ── */}
              <div className="hidden lg:block space-y-2.5">
                {clockState === "idle" && (
                  <button
                    onClick={() => handleClock("in")}
                    disabled={acting}
                    className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-emerald-600 px-6 py-4 text-[17px] font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-emerald-600/35 active:opacity-70 disabled:opacity-50"
                  >
                    {acting ? (
                      <>
                        <Spinner /> {t("processing")}
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
                        {t("clockIn")}
                      </>
                    )}
                  </button>
                )}

                {clockState === "working" && (
                  <>
                    <button
                      onClick={() => handleClock("break-start")}
                      disabled={acting}
                      className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-amber-500 px-6 py-4 text-[17px] font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 hover:shadow-amber-500/30 active:opacity-70 disabled:opacity-50"
                    >
                      {acting ? (
                        <>
                          <Spinner /> {t("processing")}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-5 w-5 transition-transform group-hover:scale-110"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <rect x="6" y="4" width="4" height="16" rx="1.5" />
                            <rect x="14" y="4" width="4" height="16" rx="1.5" />
                          </svg>
                          {t("startBreak")}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowClockOutConfirm(true)}
                      disabled={acting}
                      className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-red-200 bg-white dark:bg-zinc-900 px-6 py-3.5 text-[15px] font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 active:opacity-70 disabled:opacity-50"
                    >
                      {acting ? (
                        <>
                          <Spinner /> {t("processing")}
                        </>
                      ) : (
                        <>
                          <LogOutIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          {t("clockOut")}
                        </>
                      )}
                    </button>
                  </>
                )}

                {clockState === "break" && (
                  <>
                    <button
                      onClick={() => handleClock("break-end")}
                      disabled={acting}
                      className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-emerald-600 px-6 py-4 text-[17px] font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-emerald-600/35 active:opacity-70 disabled:opacity-50"
                    >
                      {acting ? (
                        <>
                          <Spinner /> {t("processing")}
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
                          {t("endBreak")}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowClockOutConfirm(true)}
                      disabled={acting}
                      className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-red-200 bg-white dark:bg-zinc-900 px-6 py-3.5 text-[15px] font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 active:opacity-70 disabled:opacity-50"
                    >
                      <LogOutIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      {t("clockOut")}
                    </button>
                  </>
                )}
              </div>

              {/* GPS indicator removed — collection disabled */}
            </div>
          </div>

          {/* ── Today's log ── */}
          {todayEntries.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-[15px] font-semibold text-gray-900">
                    {t("todayLog")}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {todayHours}h {String(todayMins).padStart(2, "0")}m{" "}
                  {t("total")}
                </span>
              </div>
              <div className="mx-4 h-px bg-black/[0.06]" />
              <div className="divide-y divide-gray-50">
                {todayEntries.map((e, idx) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-semibold text-gray-500">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {e.startTime} – {e.endTime || "–"}
                      </p>
                      {e.breakMinutes > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t("breakDuration")}: {e.breakMinutes} min
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-bold text-gray-900">
                        {Math.floor(e.netMinutes / 60)}h
                        {String(e.netMinutes % 60).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Team Overview (management only) ── */}
        {isManager && (
          <div className="mx-auto mt-6 max-w-4xl">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-[15px] font-semibold text-gray-900">
                      {t("teamOverview")}
                    </h3>
                  </div>
                  <button
                    onClick={fetchTeam}
                    disabled={teamLoading}
                    className="rounded-[10px] bg-[#f2f2f7] px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors active:opacity-70 hover:bg-[#e5e5ea] disabled:opacity-50"
                  >
                    {teamLoading ? <Spinner /> : t("refreshTeam")}
                  </button>
                </div>

                {/* Summary badges */}
                {teamSummary && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {t("employeesWorking", {
                        count: teamSummary.working,
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      {t("employeesOnBreak", {
                        count: teamSummary.onBreak,
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-gray-500">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      {t("employeesOffline", {
                        count: teamSummary.offline,
                      })}
                    </span>
                  </div>
                )}

                {/* Team list */}
                {teamLoading && teamData.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  </div>
                ) : teamData.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    {t("noTeamEntries")}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {teamData.map((m) => {
                      const initials =
                        (m.employee.firstName?.[0] ?? "") +
                        (m.employee.lastName?.[0] ?? "");
                      const fullName = `${m.employee.firstName} ${m.employee.lastName}`;
                      const totalH = Math.floor(m.totalNetMinutes / 60);
                      const totalM = m.totalNetMinutes % 60;

                      return (
                        <div
                          key={m.employee.id}
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                            m.status === "working"
                              ? "bg-green-50/70"
                              : m.status === "break"
                                ? "bg-amber-50/70"
                                : "bg-[#f2f2f7]/60"
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{
                              backgroundColor: m.employee.color || "#10b981",
                            }}
                          >
                            {initials}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {fullName}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  m.status === "working"
                                    ? "bg-green-500 animate-pulse"
                                    : m.status === "break"
                                      ? "bg-amber-500 animate-pulse"
                                      : "bg-gray-400"
                                }`}
                              />
                              <span className="text-xs text-gray-500">
                                {m.status === "working"
                                  ? t("statusWorking")
                                  : m.status === "break"
                                    ? t("statusBreak")
                                    : t("statusOffline")}
                                {m.status === "break" && m.active?.breakStart
                                  ? ` · ${t("since")} ${m.active.breakStart}`
                                  : m.status === "working" &&
                                      m.active?.startTime
                                    ? ` · ${t("since")} ${m.active.startTime}`
                                    : null}
                              </span>
                            </div>
                          </div>

                          {/* Today's total */}
                          {m.totalNetMinutes > 0 && (
                            <span className="shrink-0 text-xs font-medium text-gray-500">
                              {totalH}h {String(totalM).padStart(2, "0")}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </PageContent>

      {/* ── Mobile Sticky Bottom Action Bar ── */}
      {!loading && !noProfile && (
        <div className="fixed inset-x-0 z-40 lg:hidden bottom-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-xl border-t border-gray-100/60 px-4 py-3">
            {clockState === "idle" && (
              <button
                onClick={() => handleClock("in")}
                disabled={acting}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-4 text-[17px] font-semibold text-white shadow-lg shadow-emerald-600/25 active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {acting ? (
                  <>
                    <Spinner /> {t("processing")}
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-5 w-5" />
                    {t("clockIn")}
                  </>
                )}
              </button>
            )}
            {clockState === "working" && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleClock("break-start")}
                  disabled={acting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 text-[15px] font-semibold text-white shadow-lg shadow-amber-500/20 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" rx="1.5" />
                    <rect x="14" y="4" width="4" height="16" rx="1.5" />
                  </svg>
                  {t("startBreak")}
                </button>
                <button
                  onClick={() => setShowClockOutConfirm(true)}
                  disabled={acting}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white dark:bg-zinc-900 px-5 py-4 text-[15px] font-semibold text-red-600 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <LogOutIcon className="h-4 w-4" />
                  {t("clockOut")}
                </button>
              </div>
            )}
            {clockState === "break" && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleClock("break-end")}
                  disabled={acting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-[15px] font-semibold text-white shadow-lg shadow-emerald-600/25 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <PlayIcon className="h-4 w-4" />
                  {t("endBreak")}
                </button>
                <button
                  onClick={() => setShowClockOutConfirm(true)}
                  disabled={acting}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white dark:bg-zinc-900 px-5 py-4 text-[15px] font-semibold text-red-600 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <LogOutIcon className="h-4 w-4" />
                  {t("clockOut")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Early Clock-Out Confirmation Dialog ── */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowClockOutConfirm(false)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
            {/* Header */}
            <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {t("earlyClockOut.title")}
              </h3>
            </div>
            {/* Body */}
            <div className="px-6 pb-2 space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                {t("earlyClockOut.message")}
              </p>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t("earlyClockOut.restPeriodWarning")}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {t("earlyClockOut.consequences")}
                </p>
                <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    {t("earlyClockOut.consequence1")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    {t("earlyClockOut.consequence2")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    {t("earlyClockOut.consequence3")}
                  </li>
                </ul>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 px-6 pt-4 pb-6">
              <button
                onClick={() => setShowClockOutConfirm(false)}
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                {t("earlyClockOut.cancel")}
              </button>
              <button
                onClick={() => {
                  setShowClockOutConfirm(false);
                  handleClock("out");
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition-colors hover:bg-red-700 active:scale-[0.97]"
              >
                {t("earlyClockOut.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
