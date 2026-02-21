"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";

export default function StempeluhrSeite() {
  const t = useTranslations("punchClock");
  const [active, setActive] = useState(false);
  const [entry, setEntry] = useState<{
    id: string;
    clockInAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries/clock");
      if (res.ok) {
        const data = await res.json();
        setActive(data.active);
        setEntry(data.entry);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Live timer
  useEffect(() => {
    if (active && entry?.clockInAt) {
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
  }, [active, entry?.clockInAt]);

  async function handleClock(action: "in" | "out") {
    setActing(true);
    try {
      // Try to get GPS
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
          }),
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // GPS not available — continue without
      }

      const res = await fetch("/api/time-entries/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lat, lng }),
      });

      if (res.ok) {
        await fetchStatus();
      }
    } catch {
      // ignore
    } finally {
      setActing(false);
    }
  }

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
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            {/* Status indicator */}
            <div
              className={`mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full ${
                active
                  ? "bg-green-50 ring-4 ring-green-200"
                  : "bg-gray-50 ring-4 ring-gray-200"
              }`}
            >
              <div
                className={`h-20 w-20 rounded-full ${
                  active ? "bg-green-500 animate-pulse" : "bg-gray-300"
                }`}
              />
            </div>

            {/* Timer */}
            {active && elapsed && (
              <p className="mb-2 text-4xl font-mono font-bold text-gray-900">
                {elapsed}
              </p>
            )}

            <p className="mb-6 text-sm text-gray-500">
              {active
                ? `${t("active")} ${entry?.clockInAt ? new Date(entry.clockInAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""}`
                : t("inactive")}
            </p>

            {/* Action buttons */}
            {active ? (
              <button
                onClick={() => handleClock("out")}
                disabled={acting}
                className="w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {acting ? "..." : t("clockOut")}
              </button>
            ) : (
              <button
                onClick={() => handleClock("in")}
                disabled={acting}
                className="w-full rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {acting ? "..." : t("clockIn")}
              </button>
            )}

            <p className="mt-4 text-xs text-gray-400">{t("gpsNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
