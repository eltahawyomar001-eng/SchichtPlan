"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import {
  ClockIcon,
  AlertTriangleIcon,
  MapPinIcon,
  UsersIcon,
  PlayIcon,
  LogOutIcon,
  CheckCircleIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

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
    clockInLat: number | null;
    clockInLng: number | null;
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
  const [error, setError] = useState("");
  const [noProfile, setNoProfile] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

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
  }, [t]);

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

  // ── Live timer ──
  useEffect(() => {
    if (
      (clockState === "working" || clockState === "break") &&
      entry?.clockInAt
    ) {
      const update = () => {
        const diff = Date.now() - new Date(entry.clockInAt).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        );
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsed("");
    }
  }, [clockState, entry?.clockInAt]);

  // ── Perform action ──
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
        };
        setError(errorMessages[errorKey] || t("errorGeneric"));
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
              <CardContent className="p-8 text-center">
                <AlertTriangleIcon className="mx-auto mb-4 h-12 w-12 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {t("noProfileTitle")}
                </h2>
                <p className="text-sm text-gray-500">{t("noProfileDesc")}</p>
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
            <div className="flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-[15px] font-medium text-red-700">
              <AlertTriangleIcon className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Main clock card ── */}
          <div
            className={`relative overflow-hidden rounded-2xl transition-all duration-500 ${
              clockState === "working"
                ? "bg-gradient-to-b from-emerald-50 to-white shadow-[0_2px_20px_-4px_rgba(5,150,105,0.2)]"
                : clockState === "break"
                  ? "bg-gradient-to-b from-amber-50 to-white shadow-[0_2px_20px_-4px_rgba(217,119,6,0.2)]"
                  : "bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.08)]"
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
                        : "bg-gray-100 text-gray-500"
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
                  {/* Digital clock digits */}
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
                  <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
                    <span>{t("todayLog")}</span>
                    <span className="font-medium text-gray-600">
                      {todayHours}h {String(todayMins).padStart(2, "0")}m
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        clockState === "working"
                          ? "bg-emerald-500"
                          : "bg-amber-400"
                      }`}
                      style={{
                        width: `${Math.min(100, (todayTotalMinutes / 480) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-gray-300">
                    / 8h
                  </p>
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
                      onClick={() => handleClock("out")}
                      disabled={acting}
                      className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-red-200 bg-white px-6 py-3.5 text-[15px] font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 active:opacity-70 disabled:opacity-50"
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
                      onClick={() => handleClock("out")}
                      disabled={acting}
                      className="group flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-red-200 bg-white px-6 py-3.5 text-[15px] font-semibold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 active:opacity-70 disabled:opacity-50"
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
            <div className="rounded-2xl bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.08)] overflow-hidden">
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
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
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
            <div className="rounded-2xl bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.08)] overflow-hidden">
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
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
                                {m.active?.startTime &&
                                  ` · ${t("since")} ${m.active.startTime}`}
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
          <div className="bg-white/80 backdrop-blur-xl border-t border-gray-100/60 px-4 py-3">
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
                  onClick={() => handleClock("out")}
                  disabled={acting}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-4 text-[15px] font-semibold text-red-600 active:scale-[0.97] transition-transform disabled:opacity-50"
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
                  onClick={() => handleClock("out")}
                  disabled={acting}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-4 text-[15px] font-semibold text-red-600 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <LogOutIcon className="h-4 w-4" />
                  {t("clockOut")}
                </button>
              </div>
            )}
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
