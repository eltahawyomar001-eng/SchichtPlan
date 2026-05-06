"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, NextIntlClientProvider } from "next-intl";
import {
  AlertTriangleIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ArrowLeftIcon,
} from "@/components/icons";
import enMessages from "../../../messages/en.json";
import deMessages from "../../../messages/de.json";

// Both locale bundles are inlined so the stempel page can respect
// ?lang=en/de from the QR URL even when the scanning device has no
// locale cookie (employees on personal phones).
const ALL_MESSAGES = { en: enMessages, de: deMessages } as const;

type Stage =
  | "loading"
  | "token-error"
  | "pin"
  | "pin-error"
  | "identified"
  | "punching"
  | "success";

interface Employee {
  employeeId: string;
  employeeName: string;
  firstName: string;
}

interface PunchResult {
  action: "in" | "out";
  employeeName: string;
  time: string;
  netMinutes?: number;
}

const AUTO_RESET_MS = 3_500;

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
    />
  );
}

function FastPunchContent() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const t = useTranslations("qrStation");

  const [workspaceName, setWorkspaceName] = useState("");
  const [stage, setStage] = useState<Stage>("loading");
  const [tokenError, setTokenError] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [shake, setShake] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [punchError, setPunchError] = useState("");
  const [result, setResult] = useState<PunchResult | null>(null);
  const [countdown, setCountdown] = useState(AUTO_RESET_MS / 1000);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedPinRef = useRef("");

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setTokenError(t("noQrCode"));
      setStage("token-error");
      return;
    }
    try {
      const res = await fetch(
        `/api/qr-clock/employees?t=${encodeURIComponent(token)}`,
      );
      if (res.status === 401) {
        setTokenError(t("expiredCode"));
        setStage("token-error");
        return;
      }
      if (!res.ok) {
        setTokenError(t("loadError"));
        setStage("token-error");
        return;
      }
      const data = await res.json();
      setWorkspaceName(data.workspaceName);
      setStage("pin");
    } catch {
      setTokenError(t("networkError"));
      setStage("token-error");
    }
  }, [token, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkspace();
  }, [loadWorkspace]);

  const identify = useCallback(
    async (enteredPin: string) => {
      try {
        const res = await fetch("/api/qr-clock/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, pin: enteredPin }),
        });

        if (res.status === 401) {
          setTokenError(t("expiredCode"));
          setStage("token-error");
          return;
        }

        if (!res.ok) {
          setShake(true);
          setPinError(t("pinInvalid"));
          setTimeout(() => {
            setShake(false);
            setPin("");
            setPinError("");
            setStage("pin");
          }, 800);
          setStage("pin-error");
          return;
        }

        const data: Employee = await res.json();
        verifiedPinRef.current = enteredPin;
        setEmployee(data);
        setPin("");
        setStage("identified");
      } catch {
        setPinError(t("networkErrorRetry"));
        setStage("pin-error");
        setTimeout(() => {
          setPin("");
          setPinError("");
          setStage("pin");
        }, 1200);
      }
    },
    [token, t],
  );

  const punch = useCallback(
    async (action: "in" | "out") => {
      if (!employee) return;
      setStage("punching");
      setPunchError("");
      try {
        const res = await fetch("/api/qr-clock/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, pin: verifiedPinRef.current, action }),
        });
        if (!res.ok) {
          const data = await res.json();
          if (data.error === "INVALID_OR_EXPIRED_TOKEN") {
            setTokenError(t("expiredCode"));
            setStage("token-error");
          } else if (data.error === "ALREADY_CLOCKED_IN") {
            setPunchError(t("alreadyClockedIn"));
            setStage("identified");
          } else if (data.error === "NOT_CLOCKED_IN") {
            setPunchError(t("notClockedIn"));
            setStage("identified");
          } else {
            setPunchError(t("generalError"));
            setStage("identified");
          }
          return;
        }
        const data = await res.json();
        setResult({
          action: data.action,
          employeeName: data.employeeName,
          time: data.time,
          netMinutes: data.netMinutes,
        });
        setStage("success");
      } catch {
        setPunchError(t("networkErrorPunch"));
        setStage("identified");
      }
    },
    [employee, token, t],
  );

  useEffect(() => {
    if (stage !== "success") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(AUTO_RESET_MS / 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          verifiedPinRef.current = "";
          setResult(null);
          setEmployee(null);
          setPin("");
          setPunchError("");
          setStage("pin");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [stage]);

  const pressDigit = (d: string) => {
    if (stage !== "pin") return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setStage("pin-error");
      identify(next);
    }
  };

  const deleteDigit = () => {
    if (stage !== "pin") return;
    setPin((p) => p.slice(0, -1));
    setPinError("");
  };

  // ── Token error ──
  if (stage === "token-error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
        <div className="text-center space-y-4 max-w-xs w-full">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangleIcon className="h-8 w-8 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{t("invalidCode")}</p>
          <p className="text-gray-500 text-sm leading-relaxed">{tokenError}</p>
          <p className="text-xs text-gray-400">{t("scanAgain")}</p>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="h-8 w-8 text-emerald-500" />
      </div>
    );
  }

  // ── Success screen ──
  if (stage === "success" && result) {
    const isIn = result.action === "in";
    const hours =
      result.netMinutes != null ? Math.floor(result.netMinutes / 60) : null;
    const mins = result.netMinutes != null ? result.netMinutes % 60 : null;

    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-8 ${
          isIn ? "bg-emerald-500" : "bg-red-500"
        }`}
      >
        <div className="text-center space-y-5 max-w-xs w-full">
          <CheckCircleIcon className="mx-auto h-24 w-24 text-white" />
          <div className="space-y-1">
            <p className="text-3xl font-bold text-white">
              {isIn ? t("clockedIn") : t("clockedOut")}
            </p>
            <p className="text-lg text-white/80 font-medium">
              {result.employeeName}
            </p>
            <p className="text-3xl font-mono font-bold text-white">
              {t("timeAt", { time: result.time })}
            </p>
            {!isIn && hours !== null && mins !== null && (
              <p className="text-sm text-white/70">
                {t("netTime", { hours, mins })}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <div className="h-1.5 w-full rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-1000"
                style={{
                  width: `${(countdown / (AUTO_RESET_MS / 1000)) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-white/60">
              {t("resetsIn", { seconds: countdown })}
            </p>
          </div>

          <button
            onClick={() => {
              if (countdownRef.current) clearInterval(countdownRef.current);
              verifiedPinRef.current = "";
              setResult(null);
              setEmployee(null);
              setPin("");
              setPunchError("");
              setStage("pin");
            }}
            className="w-full py-4 rounded-2xl bg-white text-gray-900 text-xl font-bold active:scale-95 transition-transform shadow-lg"
          >
            {t("done")}
          </button>
        </div>
      </div>
    );
  }

  // ── Identified: IN / OUT ──
  if (stage === "identified" || stage === "punching") {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-6 py-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {workspaceName}
          </p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">
            {t("punchStation")}
          </p>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8 max-w-sm mx-auto w-full">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">{t("welcome")}</p>
            <p className="text-3xl font-bold text-gray-900">
              {employee?.firstName}!
            </p>
          </div>

          {punchError && (
            <div className="w-full rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-center">
              <p className="text-sm text-red-600 font-medium">{punchError}</p>
            </div>
          )}

          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => punch("in")}
              disabled={stage === "punching"}
              className="w-full py-10 rounded-3xl bg-emerald-500 active:bg-emerald-600 disabled:opacity-60 active:scale-95 transition-all shadow-xl shadow-emerald-500/25 text-white text-4xl font-black tracking-wider"
            >
              {stage === "punching" ? (
                <Spinner className="h-8 w-8 mx-auto border-white border-t-transparent" />
              ) : (
                t("clockIn")
              )}
            </button>
            <button
              onClick={() => punch("out")}
              disabled={stage === "punching"}
              className="w-full py-10 rounded-3xl bg-red-500 active:bg-red-600 disabled:opacity-60 active:scale-95 transition-all shadow-xl shadow-red-500/25 text-white text-4xl font-black tracking-wider"
            >
              {stage === "punching" ? (
                <Spinner className="h-8 w-8 mx-auto border-white border-t-transparent" />
              ) : (
                t("clockOut")
              )}
            </button>
          </div>

          <button
            onClick={() => {
              verifiedPinRef.current = "";
              setEmployee(null);
              setPin("");
              setPunchError("");
              setStage("pin");
            }}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {t("changePin")}
          </button>
        </div>
      </div>
    );
  }

  // ── PIN keypad ──
  const isPinStage = stage === "pin" || stage === "pin-error";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 text-center shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {workspaceName || t("punchStation")}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-500" />
          <p className="text-sm font-semibold text-gray-700">
            {t("workspaceVerified")}
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8 max-w-sm mx-auto w-full">
        <p className="text-gray-500 text-center text-sm font-medium">
          {t("enterPin")}
        </p>

        {/* PIN dots */}
        <div
          className={`flex gap-5 ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? "bg-gray-900 border-gray-900 scale-110"
                  : "bg-transparent border-gray-300"
              }`}
            />
          ))}
        </div>

        {pinError && (
          <p className="text-sm text-red-500 font-medium text-center -mt-4">
            {pinError}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              disabled={!isPinStage || pin.length >= 4}
              className="h-[72px] rounded-2xl bg-white border border-gray-200 text-2xl font-semibold text-gray-900 active:bg-gray-100 active:scale-95 transition-all shadow-sm disabled:opacity-40 select-none"
            >
              {d}
            </button>
          ))}
          <button
            onClick={deleteDigit}
            disabled={!isPinStage || pin.length === 0}
            className="h-[72px] rounded-2xl bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100 active:scale-95 transition-all shadow-sm disabled:opacity-30 select-none"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => pressDigit("0")}
            disabled={!isPinStage || pin.length >= 4}
            className="h-[72px] rounded-2xl bg-white border border-gray-200 text-2xl font-semibold text-gray-900 active:bg-gray-100 active:scale-95 transition-all shadow-sm disabled:opacity-40 select-none"
          >
            0
          </button>
          <div />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          <span>{t("noGps")}</span>
        </div>
        <p className="text-[11px] text-gray-300 text-center max-w-[260px] leading-snug">
          {t("dataRetentionHint")}
        </p>
      </div>
    </div>
  );
}

/**
 * Reads the ?lang param and wraps FastPunchContent in a locale-specific
 * NextIntlClientProvider when it differs from the server-side cookie locale.
 * This ensures employees scanning the QR code on their own phones (no cookie)
 * see the station in the workspace language rather than defaulting to German.
 */
function LocaleWrapper({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const lang = params.get("lang");
  if (lang === "en" || lang === "de") {
    return (
      <NextIntlClientProvider locale={lang} messages={ALL_MESSAGES[lang]}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return <>{children}</>;
}

export default function StempelPage() {
  const fallback = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner className="h-8 w-8 text-emerald-500" />
    </div>
  );
  return (
    <Suspense fallback={fallback}>
      <LocaleWrapper>
        <FastPunchContent />
      </LocaleWrapper>
    </Suspense>
  );
}
