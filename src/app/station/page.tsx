"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "shiftfy_station_key";
const STORAGE_WORKSPACE = "shiftfy_station_workspace";
const REFRESH_BEFORE_EXPIRY_MS = 5_000;
const POLL_MS = 3_000;
const NOTIF_DURATION_MS = 5_000;

interface PunchNotification {
  id: string;
  action: "in" | "out";
  employeeName: string;
  time: string;
}

function StationContent() {
  const params = useSearchParams();
  const setupToken = params.get("setup");

  // Station auth state
  const [stationKey, setStationKey] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [authState, setAuthState] = useState<
    "loading" | "authorizing" | "ready" | "error"
  >("loading");
  const [authError, setAuthError] = useState("");

  // QR display state
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [qrError, setQrError] = useState("");

  // Live clock
  const [currentTime, setCurrentTime] = useState("");

  // Success notification (from polling)
  const [notification, setNotification] = useState<PunchNotification | null>(
    null,
  );
  const [showNotif, setShowNotif] = useState(false);

  const lastPunchIdRef = useRef<string | null>(null);
  const sinceRef = useRef(new Date().toISOString());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock ticker
  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("de-DE", {
          timeZone: "Europe/Berlin",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    tick();
    clockRef.current = setInterval(tick, 10_000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // QR fetch & auto-refresh
  const fetchQr = useCallback(async (key: string) => {
    setQrError("");
    try {
      const res = await fetch(
        `/api/station/qr-token?key=${encodeURIComponent(key)}`,
      );
      if (res.status === 401) {
        setAuthError(
          "Station-Sitzung abgelaufen. Bitte einen neuen Setup-Link anfordern.",
        );
        setAuthState("error");
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (!res.ok) throw new Error("fetch_failed");

      const { token, expiresAt: exp } = await res.json();
      setExpiresAt(exp);
      setSecondsLeft(Math.round((exp - Date.now()) / 1000));

      // Build punch URL and generate QR
      const origin = window.location.origin;
      const punchUrl = `${origin}/stempel?t=${token}`;
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(punchUrl, {
        width: 360,
        margin: 2,
        color: { dark: "#111827", light: "#FFFFFF" },
      });
      setQrDataUrl(dataUrl);

      // Schedule next refresh
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const delay = exp - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
      refreshTimerRef.current = setTimeout(
        () => fetchQr(key),
        Math.max(delay, 1000),
      );
    } catch {
      setQrError("QR-Code konnte nicht geladen werden.");
      // Retry in 10s
      refreshTimerRef.current = setTimeout(() => fetchQr(key), 10_000);
    }
  }, []);

  // Countdown ticker (depends on expiresAt)
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (!expiresAt) return prev;
        return Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      });
    }, 500);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [expiresAt]);

  // Poll for recent punches (station feedback overlay)
  const startPolling = useCallback((key: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/station/recent-punch?key=${encodeURIComponent(key)}&since=${encodeURIComponent(sinceRef.current)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data.punch) return;
        if (data.punch.id === lastPunchIdRef.current) return;

        // New punch detected
        lastPunchIdRef.current = data.punch.id;
        sinceRef.current = new Date().toISOString();
        setNotification(data.punch);
        setShowNotif(true);

        if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
        notifTimerRef.current = setTimeout(() => {
          setShowNotif(false);
          setTimeout(() => setNotification(null), 500); // wait for fade-out
        }, NOTIF_DURATION_MS);
      } catch {
        // Silent — polling is best-effort
      }
    }, POLL_MS);
  }, []);

  // Authorize device: exchange setup token for station key
  const authorize = useCallback(async (token: string) => {
    setAuthState("authorizing");
    try {
      const res = await fetch("/api/station/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(
          data.error === "INVALID_OR_EXPIRED_TOKEN"
            ? "Setup-Link abgelaufen oder ungültig. Bitte einen neuen Link anfordern."
            : "Autorisierung fehlgeschlagen. Bitte erneut versuchen.",
        );
        setAuthState("error");
        return;
      }
      localStorage.setItem(STORAGE_KEY, data.stationKey);
      localStorage.setItem(STORAGE_WORKSPACE, data.workspaceName);
      setStationKey(data.stationKey);
      setWorkspaceName(data.workspaceName);
      setAuthState("ready");

      // Remove setup token from URL without reload
      window.history.replaceState({}, "", "/station");
    } catch {
      setAuthError("Netzwerkfehler. Bitte erneut versuchen.");
      setAuthState("error");
    }
  }, []);

  // Bootstrap: read localStorage or process setup token
  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY);
    const storedWorkspace = localStorage.getItem(STORAGE_WORKSPACE);

    if (setupToken) {
      // New device authorization flow
      authorize(setupToken);
    } else if (storedKey) {
      setStationKey(storedKey);
      setWorkspaceName(storedWorkspace ?? "");
      setAuthState("ready");
    } else {
      setAuthState("error");
      setAuthError("Dieses Gerät ist nicht autorisiert.");
    }
  }, [setupToken, authorize]);

  // Start QR + polling once key is ready
  useEffect(() => {
    if (authState !== "ready" || !stationKey) return;
    fetchQr(stationKey);
    startPolling(stationKey);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, [authState, stationKey, fetchQr, startPolling]);

  const progress = expiresAt
    ? Math.max(0, ((expiresAt - Date.now()) / 60_000) * 100)
    : (secondsLeft / 60) * 100;
  const urgent = secondsLeft <= 10;

  // ── Not authorized ──
  if (authState === "loading" || authState === "authorizing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-white/60 text-sm">
            {authState === "authorizing"
              ? "Gerät wird autorisiert…"
              : "Wird geladen…"}
          </p>
        </div>
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-5xl">🔒</div>
        <div className="space-y-2">
          <p className="text-white text-xl font-bold">Nicht autorisiert</p>
          <p className="text-white/60 text-sm max-w-sm">{authError}</p>
        </div>
        <p className="text-white/40 text-xs">
          Admin: Einstellungen → Stempeluhr → Station-Link generieren
        </p>
      </div>
    );
  }

  // ── Ready: QR display ──
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest font-medium">
            Stempelstation
          </p>
          <p className="text-white font-semibold text-lg leading-tight">
            {workspaceName}
          </p>
        </div>
        <p className="text-white/60 text-2xl font-mono font-bold tabular-nums">
          {currentTime}
        </p>
      </div>

      {/* Main QR area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-4">
        <p className="text-white/70 text-lg font-medium">
          📱 Handy-Kamera öffnen &amp; scannen
        </p>

        <div className="relative">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR-Code zum Stempeln"
              className={`rounded-3xl shadow-2xl transition-opacity duration-500 ${
                urgent ? "opacity-60" : "opacity-100"
              }`}
              style={{ width: 320, height: 320 }}
            />
          ) : qrError ? (
            <div className="h-80 w-80 rounded-3xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center gap-3 text-center p-6">
              <p className="text-white/50 text-sm">{qrError}</p>
              <button
                onClick={() => stationKey && fetchQr(stationKey)}
                className="text-emerald-400 text-sm font-medium hover:underline"
              >
                Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="h-80 w-80 rounded-3xl bg-gray-800 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          )}

          {/* Urgent flash overlay */}
          {urgent && qrDataUrl && (
            <div className="absolute inset-0 rounded-3xl border-4 border-orange-400 animate-pulse" />
          )}
        </div>

        {/* Countdown bar */}
        <div className="w-80 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Code gültig noch</span>
            <span
              className={`font-bold tabular-nums ${
                urgent ? "text-orange-400" : "text-white/60"
              }`}
            >
              {secondsLeft}s
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                urgent ? "bg-orange-500" : "bg-emerald-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/30 text-xs text-center">
            Erneuert sich automatisch
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-white/20 text-xs">🔒 Kein GPS · Kein Tracking</p>
      </div>

      {/* Punch success overlay */}
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
          showNotif ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${notification?.action === "out" ? "bg-red-500" : "bg-emerald-500"}`}
      >
        {notification && (
          <div className="text-center space-y-4 px-8">
            <div className="text-8xl font-black text-white">✓</div>
            <p className="text-4xl font-bold text-white">
              {notification.action === "in"
                ? "Eingestempelt!"
                : "Ausgestempelt!"}
            </p>
            <p className="text-2xl text-white/80 font-medium">
              {notification.employeeName}
            </p>
            <p className="text-3xl font-mono font-bold text-white">
              {notification.time} Uhr
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <StationContent />
    </Suspense>
  );
}
