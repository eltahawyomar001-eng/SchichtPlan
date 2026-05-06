"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  position: string | null;
}

function FastPunchContent() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";

  const [workspaceName, setWorkspaceName] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [punching, setPunching] = useState(false);
  const [result, setResult] = useState<{
    action: "in" | "out";
    employeeName: string;
    time: string;
    netMinutes?: number;
  } | null>(null);
  const [punchError, setPunchError] = useState("");

  const fetchEmployees = useCallback(async () => {
    if (!token) {
      setTokenError("Kein gültiger QR-Code. Bitte den Code erneut scannen.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/qr-clock/employees?t=${encodeURIComponent(token)}`,
      );
      if (res.status === 401) {
        setTokenError("QR-Code abgelaufen. Bitte den Code erneut scannen.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setTokenError("Fehler beim Laden. Bitte erneut scannen.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setWorkspaceName(data.workspaceName);
      setEmployees(data.employees);
    } catch {
      setTokenError("Netzwerkfehler. Bitte erneut scannen.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const punch = useCallback(
    async (action: "in" | "out") => {
      if (!selectedEmployee || !token) return;
      setPunching(true);
      setPunchError("");
      try {
        const res = await fetch("/api/qr-clock/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            employeeId: selectedEmployee.id,
            action,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === "INVALID_OR_EXPIRED_TOKEN") {
            setPunchError("QR-Code abgelaufen. Bitte erneut scannen.");
          } else if (data.error === "ALREADY_CLOCKED_IN") {
            setPunchError("Sie sind bereits eingestempelt.");
          } else if (data.error === "NOT_CLOCKED_IN") {
            setPunchError("Sie sind nicht eingestempelt.");
          } else {
            setPunchError("Fehler. Bitte versuchen Sie es erneut.");
          }
          return;
        }
        setResult({
          action: data.action,
          employeeName: data.employeeName,
          time: data.time,
          netMinutes: data.netMinutes,
        });
      } catch {
        setPunchError("Netzwerkfehler. Bitte erneut versuchen.");
      } finally {
        setPunching(false);
      }
    },
    [selectedEmployee, token],
  );

  // ── Success screen ──
  if (result) {
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
          <button
            onClick={() => {
              setResult(null);
              setSelectedEmployee(null);
              setPunchError("");
            }}
            className="mt-8 w-full py-5 rounded-2xl bg-white text-gray-900 text-xl font-bold active:scale-95 transition-transform shadow-lg"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  // ── Token error screen ──
  if (tokenError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4 max-w-sm w-full">
          <p className="text-5xl">⚠️</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            Code ungültig
          </p>
          <p className="text-gray-600 dark:text-gray-400">{tokenError}</p>
          <p className="text-sm text-gray-400">
            Bitte einen neuen QR-Code scannen.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Punch screen ──
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
          {workspaceName}
        </p>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          Stempeluhr
        </p>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 max-w-md mx-auto w-full">
        {/* Employee selector */}
        {!selectedEmployee ? (
          <div className="flex-1 flex flex-col gap-3">
            <p className="text-center text-gray-700 dark:text-gray-300 font-medium text-lg mt-4">
              Wer stempelt?
            </p>
            <div className="space-y-2">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-left active:scale-95 transition-transform shadow-sm"
                >
                  <span
                    className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: emp.color || "#6b7280" }}
                  >
                    {emp.firstName[0]}
                    {emp.lastName[0]}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {emp.firstName} {emp.lastName}
                    </p>
                    {emp.position && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {emp.position}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {/* Selected employee header */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setPunchError("");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ← Wechseln
              </button>
              <div className="flex items-center gap-2 flex-1">
                <span
                  className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
                  style={{
                    backgroundColor: selectedEmployee.color || "#6b7280",
                  }}
                >
                  {selectedEmployee.firstName[0]}
                  {selectedEmployee.lastName[0]}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </span>
              </div>
            </div>

            {punchError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-center">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  {punchError}
                </p>
              </div>
            )}

            {/* Giant IN / OUT buttons */}
            <div className="flex-1 flex flex-col gap-4 justify-center">
              <button
                onClick={() => punch("in")}
                disabled={punching}
                className="w-full py-10 rounded-3xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-emerald-500/30 text-white text-4xl font-black tracking-wide"
              >
                {punching ? (
                  <span className="block h-8 w-8 rounded-full border-4 border-white border-t-transparent animate-spin mx-auto" />
                ) : (
                  "REIN"
                )}
              </button>

              <button
                onClick={() => punch("out")}
                disabled={punching}
                className="w-full py-10 rounded-3xl bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-red-500/30 text-white text-4xl font-black tracking-wide"
              >
                {punching ? (
                  <span className="block h-8 w-8 rounded-full border-4 border-white border-t-transparent animate-spin mx-auto" />
                ) : (
                  "RAUS"
                )}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-2">
              Kein GPS. Kein Tracking.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StempelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="h-10 w-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <FastPunchContent />
    </Suspense>
  );
}
