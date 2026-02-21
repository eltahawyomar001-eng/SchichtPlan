"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { ClockIcon, AlertTriangleIcon, MapPinIcon } from "@/components/icons";
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

type ClockState = "idle" | "working" | "break";

export default function StempeluhrSeite() {
  const { data: session } = useSession();
  const t = useTranslations("punchClock");
  const user = session?.user as SessionUser | undefined;

  const [clockState, setClockState] = useState<ClockState>("idle");
  const [entry, setEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const [error, setError] = useState("");
  const [noProfile, setNoProfile] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"unknown" | "granted" | "denied">(
    "unknown",
  );
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

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

  // ── Check GPS permission ──
  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setGpsStatus(result.state === "denied" ? "denied" : "granted");
        })
        .catch(() => setGpsStatus("unknown"));
    }
  }, []);

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
      // Try GPS for clock-in / clock-out
      let lat: number | undefined;
      let lng: number | undefined;
      if (action === "in" || action === "out") {
        try {
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                enableHighAccuracy: true,
              }),
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          setGpsStatus("granted");
        } catch {
          // GPS not available — continue without
        }
      }

      const res = await fetch("/api/time-entries/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lat,
          lng,
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
        <div className="p-4 sm:p-6">
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
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-md space-y-4">
          {/* ── Error banner ── */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
              <AlertTriangleIcon className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Main clock card ── */}
          <Card>
            <CardContent className="p-8 text-center">
              {/* User name */}
              {user?.name && (
                <p className="mb-4 text-sm font-medium text-gray-500">
                  {user.name}
                </p>
              )}

              {/* Status ring */}
              <div
                className={`mx-auto mb-6 flex h-36 w-36 items-center justify-center rounded-full transition-all duration-500 ${
                  clockState === "working"
                    ? "bg-green-50 ring-4 ring-green-300 shadow-lg shadow-green-100"
                    : clockState === "break"
                      ? "bg-amber-50 ring-4 ring-amber-300 shadow-lg shadow-amber-100"
                      : "bg-gray-50 ring-4 ring-gray-200"
                }`}
              >
                {clockState === "idle" ? (
                  <ClockIcon className="h-16 w-16 text-gray-300" />
                ) : (
                  <div className="text-center">
                    <p className="text-3xl font-mono font-bold text-gray-900 tabular-nums">
                      {elapsed}
                    </p>
                    <p
                      className={`mt-1 text-xs font-medium ${
                        clockState === "break"
                          ? "text-amber-600"
                          : "text-green-600"
                      }`}
                    >
                      {clockState === "break" ? t("onBreak") : t("working")}
                    </p>
                  </div>
                )}
              </div>

              {/* Clock-in time */}
              {entry?.clockInAt && clockState !== "idle" && (
                <p className="mb-4 text-sm text-gray-500">
                  {t("active")}{" "}
                  {new Date(entry.clockInAt).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}

              {clockState === "idle" && (
                <p className="mb-6 text-sm text-gray-500">{t("inactive")}</p>
              )}

              {/* ── Action buttons ── */}
              <div className="space-y-3">
                {clockState === "idle" && (
                  <button
                    onClick={() => handleClock("in")}
                    disabled={acting}
                    className="w-full rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {acting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner /> {t("processing")}
                      </span>
                    ) : (
                      t("clockIn")
                    )}
                  </button>
                )}

                {clockState === "working" && (
                  <>
                    <button
                      onClick={() => handleClock("break-start")}
                      disabled={acting}
                      className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      {acting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner /> {t("processing")}
                        </span>
                      ) : (
                        t("startBreak")
                      )}
                    </button>
                    <button
                      onClick={() => handleClock("out")}
                      disabled={acting}
                      className="w-full rounded-xl bg-red-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
                    >
                      {acting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner /> {t("processing")}
                        </span>
                      ) : (
                        t("clockOut")
                      )}
                    </button>
                  </>
                )}

                {clockState === "break" && (
                  <>
                    <button
                      onClick={() => handleClock("break-end")}
                      disabled={acting}
                      className="w-full rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
                    >
                      {acting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner /> {t("processing")}
                        </span>
                      ) : (
                        t("endBreak")
                      )}
                    </button>
                    <button
                      onClick={() => handleClock("out")}
                      disabled={acting}
                      className="w-full rounded-xl border border-red-300 bg-white px-6 py-3 text-base font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                    >
                      {t("clockOut")}
                    </button>
                  </>
                )}
              </div>

              {/* GPS indicator */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <MapPinIcon className="h-3.5 w-3.5" />
                {gpsStatus === "denied" ? t("gpsDenied") : t("gpsNote")}
              </div>
            </CardContent>
          </Card>

          {/* ── Today's summary ── */}
          {todayEntries.length > 0 && (
            <Card>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {t("todayLog")}
                  </h3>
                  <span className="text-xs font-medium text-gray-500">
                    {t("total")}: {todayHours}h{" "}
                    {String(todayMins).padStart(2, "0")}m
                  </span>
                </div>
                <div className="space-y-2">
                  {todayEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {e.startTime} – {e.endTime}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {Math.floor(e.netMinutes / 60)}h{" "}
                          {String(e.netMinutes % 60).padStart(2, "0")}m
                        </span>
                        {e.breakMinutes > 0 && (
                          <p className="text-[10px] text-gray-400">
                            {t("breakDuration")}: {e.breakMinutes} min
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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
