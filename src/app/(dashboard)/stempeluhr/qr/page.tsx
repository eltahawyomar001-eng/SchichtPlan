"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshIcon, QrCodeIcon, ArrowLeftIcon } from "@/components/icons";

const TOKEN_TTL_MS = 60_000;
const REFRESH_BEFORE_EXPIRY_MS = 5_000; // refresh 5 s before expiry

export default function QrStationPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [punchUrl, setPunchUrl] = useState("");
  const [stationLink, setStationLink] = useState("");
  const [stationLinkCopied, setStationLinkCopied] = useState(false);
  const [stationLinkLoading, setStationLinkLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchToken = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/qr-clock/token");
      if (!res.ok) throw new Error("fetch_failed");
      const { token, expiresAt: exp } = await res.json();

      // Build the public punch URL (absolute so QR works from any device)
      const origin = window.location.origin;
      const url = `${origin}/stempel?t=${token}`;
      setPunchUrl(url);
      setExpiresAt(exp);
      setSecondsLeft(Math.round((exp - Date.now()) / 1000));
      setLoading(false);

      // Generate QR code client-side using the qrcode library
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: "#111827", light: "#FFFFFF" },
      });
      setQrDataUrl(dataUrl);

      // Schedule next refresh just before token expiry
      if (refreshRef.current) clearTimeout(refreshRef.current);
      const delay = exp - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
      refreshRef.current = setTimeout(fetchToken, Math.max(delay, 1000));
    } catch {
      setError("Token konnte nicht geladen werden. Bitte neu laden.");
      setLoading(false);
    }
  }, []);

  // Countdown ticker
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (!expiresAt) return prev;
        const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
        return s;
      });
    }, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  useEffect(() => {
    fetchToken();
    return () => {
      if (refreshRef.current) clearTimeout(refreshRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchToken]);

  const progress = Math.max(0, (secondsLeft / (TOKEN_TTL_MS / 1000)) * 100);
  const urgent = secondsLeft <= 10;

  return (
    <>
      <Topbar title="QR-Stempelstation" />
      <PageContent>
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <Link
              href="/stempeluhr"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Zurück zur Stempeluhr
            </Link>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-gray-900 dark:text-white">
                  <QrCodeIcon className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">
                    Scannen zum Stempeln
                  </h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Mitarbeiter scannen diesen Code mit ihrem Smartphone
                </p>
              </div>

              {/* QR code display */}
              <div className="flex justify-center">
                {loading ? (
                  <div className="h-80 w-80 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <RefreshIcon className="h-8 w-8 text-gray-400 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="h-80 w-80 rounded-2xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center gap-3 p-4 text-center">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                    <button
                      onClick={fetchToken}
                      className="text-sm font-medium text-emerald-600 hover:underline"
                    >
                      Erneut versuchen
                    </button>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative">
                    <img
                      src={qrDataUrl}
                      alt="QR Code für Stempelstation"
                      className="h-80 w-80 rounded-2xl shadow-lg"
                    />
                    {urgent && (
                      <div className="absolute inset-0 rounded-2xl bg-orange-500/10 border-2 border-orange-400 animate-pulse" />
                    )}
                  </div>
                ) : null}
              </div>

              {/* Countdown progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Code gültig für</span>
                  <span
                    className={
                      urgent
                        ? "font-bold text-orange-600 dark:text-orange-400"
                        : "font-medium text-gray-700 dark:text-gray-300"
                    }
                  >
                    {secondsLeft}s
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      urgent ? "bg-orange-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  Erneuert sich automatisch
                </p>
              </div>

              {/* Manual refresh */}
              <div className="flex justify-center">
                <button
                  onClick={fetchToken}
                  disabled={loading}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                >
                  <RefreshIcon
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Jetzt erneuern
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-gray-400 dark:text-gray-600">
            Kein GPS. Kein Tracking. Nur physische Anwesenheit.
          </p>

          {/* Launch Station Card */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Dedizierte Stempelstation
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Tablet oder Laptop am Eingang autorisieren — ohne Admin-Login
                  auf dem Gerät.
                </p>
              </div>
              {stationLink ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300 break-all">
                      {stationLink}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(stationLink);
                        setStationLinkCopied(true);
                        setTimeout(() => setStationLinkCopied(false), 2000);
                      }}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      {stationLinkCopied ? "✓ Kopiert!" : "Link kopieren"}
                    </button>
                    <a
                      href={stationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Öffnen
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 text-center">
                    Link ist 24 Stunden gültig
                  </p>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setStationLinkLoading(true);
                    try {
                      const res = await fetch("/api/station/setup-link");
                      if (res.ok) {
                        const data = await res.json();
                        setStationLink(data.setupUrl);
                      }
                    } finally {
                      setStationLinkLoading(false);
                    }
                  }}
                  disabled={stationLinkLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {stationLinkLoading
                    ? "Wird generiert…"
                    : "Station-Link generieren"}
                </button>
              )}
            </CardContent>
          </Card>

          {/* Debug URL (small, inconspicuous) */}
          {punchUrl && (
            <details className="text-xs text-gray-500 dark:text-zinc-400">
              <summary className="cursor-pointer">
                Direkt-Link (für Tests)
              </summary>
              <a
                href={punchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all hover:underline text-gray-600 dark:text-zinc-300"
              >
                {punchUrl}
              </a>
            </details>
          )}
        </div>
      </PageContent>
    </>
  );
}
