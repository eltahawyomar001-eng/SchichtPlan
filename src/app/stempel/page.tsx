"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

function FastPunchContent() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";

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
  // Keep verified PIN in a ref so the punch request can re-verify it server-side
  const verifiedPinRef = useRef("");

  // Validate token and load workspace name
  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setTokenError("Kein QR-Code erkannt. Bitte erneut scannen.");
      setStage("token-error");
      return;
    }
    try {
      const res = await fetch(
        `/api/qr-clock/employees?t=${encodeURIComponent(token)}`,
      );
      if (res.status === 401) {
        setTokenError("QR-Code abgelaufen. Bitte erneut scannen.");
        setStage("token-error");
        return;
      }
      if (!res.ok) {
        setTokenError("Fehler beim Laden. Bitte erneut scannen.");
        setStage("token-error");
        return;
      }
      const data = await res.json();
      setWorkspaceName(data.workspaceName);
      setStage("pin");
    } catch {
      setTokenError("Netzwerkfehler. Bitte erneut scannen.");
      setStage("token-error");
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkspace();
  }, [loadWorkspace]);

  // Auto-identify when 4 digits are entered
  const identify = useCallback(
    async (enteredPin: string) => {
      try {
        const res = await fetch("/api/qr-clock/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, pin: enteredPin }),
        });

        if (res.status === 401) {
          setTokenError("QR-Code abgelaufen. Bitte erneut scannen.");
          setStage("token-error");
          return;
        }

        if (!res.ok) {
          // Wrong PIN
          setShake(true);
          setPinError("PIN ungültig. Bitte erneut versuchen.");
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
        verifiedPinRef.current = enteredPin; // keep for punch re-verification
        setEmployee(data);
        setPin("");
        setStage("identified");
      } catch {
        setPinError("Netzwerkfehler. Bitte erneut versuchen.");
        setStage("pin-error");
        setTimeout(() => {
          setPin("");
          setPinError("");
          setStage("pin");
        }, 1200);
      }
    },
    [token],
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
          body: JSON.stringify({
            token,
            pin: verifiedPinRef.current,
            action,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          if (data.error === "INVALID_OR_EXPIRED_TOKEN") {
            setTokenError("QR-Code abgelaufen. Bitte erneut scannen.");
            setStage("token-error");
          } else if (data.error === "ALREADY_CLOCKED_IN") {
            setPunchError("Bereits eingestempelt.");
            setStage("identified");
          } else if (data.error === "NOT_CLOCKED_IN") {
            setPunchError("Nicht eingestempelt.");
            setStage("identified");
          } else {
            setPunchError("Fehler. Bitte erneut versuchen.");
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
        setPunchError("Netzwerkfehler.");
        setStage("identified");
      }
    },
    [employee, token],
  );

  // Auto-reset from success screen
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
      setStage("pin-error"); // prevent double-press while identifying
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <div className="text-center space-y-4 max-w-sm w-full">
          <p className="text-5xl">⚠️</p>
          <p className="text-xl font-bold text-gray-900">Code ungültig</p>
          <p className="text-gray-600">{tokenError}</p>
          <p className="text-sm text-gray-400">
            Bitte einen neuen QR-Code scannen.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Success screen (auto-resets) ──
  if (stage === "success" && result) {
    const isIn = result.action === "in";
    const hours = result.netMinutes ? Math.floor(result.netMinutes / 60) : null;
    const mins = result.netMinutes ? result.netMinutes % 60 : null;

    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          isIn ? "bg-emerald-500" : "bg-red-500"
        }`}
      >
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="text-9xl font-black text-white">✓</div>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-white">
              {isIn ? "Eingestempelt!" : "Ausgestempelt!"}
            </p>
            <p className="text-xl text-white/80 font-medium">
              {result.employeeName}
            </p>
            <p className="text-3xl font-mono font-bold text-white">
              {result.time} Uhr
            </p>
            {!isIn && hours !== null && mins !== null && (
              <p className="text-base text-white/70">
                Netto: {hours}h {mins}min
              </p>
            )}
          </div>
          {/* Countdown bar */}
          <div className="mt-6 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-1000"
                style={{
                  width: `${(countdown / (AUTO_RESET_MS / 1000)) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-white/60">
              Wird in {countdown}s zurückgesetzt
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
            className="mt-2 w-full py-4 rounded-2xl bg-white text-gray-900 text-xl font-bold active:scale-95 transition-transform shadow-lg"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  // ── Identified: show employee name + IN/OUT ──
  if (stage === "identified" || stage === "punching") {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 text-center">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {workspaceName}
          </p>
          <p className="text-base font-semibold text-gray-900">Stempeluhr</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-sm mx-auto w-full">
          <div className="text-center">
            <p className="text-gray-500 text-sm">Guten Tag,</p>
            <p className="text-2xl font-bold text-gray-900">
              {employee?.firstName}!
            </p>
          </div>

          {punchError && (
            <div className="w-full rounded-xl bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-sm text-red-700 font-medium">{punchError}</p>
            </div>
          )}

          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => punch("in")}
              disabled={stage === "punching"}
              className="w-full py-10 rounded-3xl bg-emerald-500 active:bg-emerald-600 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-emerald-500/30 text-white text-4xl font-black"
            >
              {stage === "punching" ? (
                <span className="block h-8 w-8 rounded-full border-4 border-white border-t-transparent animate-spin mx-auto" />
              ) : (
                "REIN"
              )}
            </button>
            <button
              onClick={() => punch("out")}
              disabled={stage === "punching"}
              className="w-full py-10 rounded-3xl bg-red-500 active:bg-red-600 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-red-500/30 text-white text-4xl font-black"
            >
              {stage === "punching" ? (
                <span className="block h-8 w-8 rounded-full border-4 border-white border-t-transparent animate-spin mx-auto" />
              ) : (
                "RAUS"
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
            className="text-sm text-gray-400 mt-2"
          >
            ← Andere PIN eingeben
          </button>
        </div>
      </div>
    );
  }

  // ── PIN keypad ──
  const isPinStage = stage === "pin" || stage === "pin-error";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 text-center">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
          {workspaceName || "Stempelstation"}
        </p>
        <p className="text-base font-semibold text-gray-900">
          Workspace verifiziert ✓
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-sm mx-auto w-full">
        <p className="text-gray-600 text-center text-sm font-medium">
          Bitte geben Sie Ihre 4-stellige PIN ein
        </p>

        {/* PIN dots */}
        <div
          className={`flex gap-4 transition-transform ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                i < pin.length
                  ? "bg-gray-900 border-gray-900 scale-110"
                  : "bg-transparent border-gray-300"
              }`}
            />
          ))}
        </div>

        {pinError && (
          <p className="text-sm text-red-600 font-medium text-center">
            {pinError}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              disabled={!isPinStage || pin.length >= 4}
              className="h-16 rounded-2xl bg-white border border-gray-200 text-2xl font-bold text-gray-900 active:bg-gray-100 active:scale-95 transition-all shadow-sm disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          {/* Bottom row: delete, 0, blank */}
          <button
            onClick={deleteDigit}
            disabled={!isPinStage || pin.length === 0}
            className="h-16 rounded-2xl bg-white border border-gray-200 text-xl font-bold text-gray-500 active:bg-gray-100 active:scale-95 transition-all shadow-sm disabled:opacity-30"
          >
            ⌫
          </button>
          <button
            onClick={() => pressDigit("0")}
            disabled={!isPinStage || pin.length >= 4}
            className="h-16 rounded-2xl bg-white border border-gray-200 text-2xl font-bold text-gray-900 active:bg-gray-100 active:scale-95 transition-all shadow-sm disabled:opacity-40"
          >
            0
          </button>
          <div /> {/* empty cell */}
        </div>

        <p className="text-xs text-gray-400 text-center">
          🔒 Kein GPS · Kein Tracking
        </p>
      </div>
    </div>
  );
}

export default function StempelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="h-10 w-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <FastPunchContent />
    </Suspense>
  );
}
