"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/components/icons";

interface SosInfo {
  id: string;
  shift: {
    date: string;
    startTime: string;
    endTime: string;
    location: { name: string } | null;
  };
  bonusAmount: string | null;
  bonusCurrency: string;
  bonusNote: string | null;
  expiresAt: string;
}

type State =
  | { phase: "loading" }
  | {
      phase: "ready";
      sos: SosInfo;
      employee: { firstName: string; lastName: string };
      notifId: string;
    }
  | { phase: "alreadyResponded"; response: string }
  | { phase: "alreadyResolved"; status: string; isSelf: boolean }
  | { phase: "expired" }
  | { phase: "accepted" }
  | { phase: "declined" }
  | { phase: "error"; message: string };

function formatName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function SosRespondClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>({ phase: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ phase: "error", message: "Kein Token gefunden." });
      return;
    }

    fetch(`/api/sos/respond?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setState({ phase: "error", message: data.error || "Fehler" });
          return;
        }
        if (data.expired) {
          setState({ phase: "expired" });
          return;
        }
        if (data.alreadyResolved) {
          setState({
            phase: "alreadyResolved",
            status: data.status,
            isSelf: data.filledById === data.employeeId,
          });
          return;
        }
        if (data.alreadyResponded) {
          setState({ phase: "alreadyResponded", response: data.response });
          return;
        }
        setState({
          phase: "ready",
          sos: data.sos,
          employee: data.employee,
          notifId: data.notifId,
        });
      })
      .catch(() => setState({ phase: "error", message: "Netzwerkfehler." }));
  }, [token]);

  const respond = async (action: "accept" | "decline") => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/sos/respond?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await res.json();
      if (data.alreadyResolved) {
        setState({
          phase: "alreadyResolved",
          status: data.status,
          isSelf: false,
        });
      } else if (data.expired) {
        setState({ phase: "expired" });
      } else {
        setState({ phase: action === "accept" ? "accepted" : "declined" });
      }
    } catch {
      setState({
        phase: "error",
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-50 dark:bg-red-950/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900/40">
            <AlertCircleIcon className="h-3.5 w-3.5" />
            <span>Notfall</span>
          </div>
          <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-zinc-100">
            Notfall-Schicht
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Shiftfy
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-lg overflow-hidden">
          {state.phase === "loading" && (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-zinc-500 animate-pulse">
              Lade…
            </div>
          )}

          {state.phase === "error" && (
            <div className="p-6 text-center space-y-3">
              <AlertCircleIcon className="h-8 w-8 mx-auto text-red-500" />
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                Ungültiger Link
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {state.message}
              </p>
            </div>
          )}

          {state.phase === "expired" && (
            <div className="p-6 text-center space-y-3">
              <ClockIcon className="h-8 w-8 mx-auto text-gray-400 dark:text-zinc-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                SOS abgelaufen
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Das Angebot ist nicht mehr aktiv. Eine andere Person hat die
                Schicht übernommen oder das SOS wurde beendet.
              </p>
            </div>
          )}

          {state.phase === "alreadyResolved" && (
            <div className="p-6 text-center space-y-3">
              {state.isSelf ? (
                <CheckCircleIcon className="h-8 w-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircleIcon className="h-8 w-8 mx-auto text-gray-400 dark:text-zinc-500" />
              )}
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                {state.isSelf
                  ? "Du hast die Schicht übernommen!"
                  : "Schicht bereits besetzt"}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {state.isSelf
                  ? "Super! Wir sehen uns auf der Schicht."
                  : "Diese Schicht wurde bereits von jemand anderem übernommen."}
              </p>
            </div>
          )}

          {state.phase === "alreadyResponded" && (
            <div className="p-6 text-center space-y-3">
              {state.response === "ACCEPTED" ? (
                <CheckCircleIcon className="h-8 w-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircleIcon className="h-8 w-8 mx-auto text-gray-400 dark:text-zinc-500" />
              )}
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                {state.response === "ACCEPTED"
                  ? "Du hast bereits zugesagt"
                  : "Du hast bereits abgelehnt"}
              </p>
            </div>
          )}

          {state.phase === "accepted" && (
            <div className="p-6 text-center space-y-3">
              <CheckCircleIcon className="h-10 w-10 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                Schicht übernommen
              </p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Danke! Die Schicht wurde dir zugewiesen. Bis dann.
              </p>
            </div>
          )}

          {state.phase === "declined" && (
            <div className="p-6 text-center space-y-3">
              <p className="text-base font-bold text-gray-700 dark:text-zinc-300">
                Alles klar
              </p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Kein Problem – wir suchen weiter.
              </p>
            </div>
          )}

          {state.phase === "ready" &&
            (() => {
              const { sos, employee } = state;
              const shiftDate = format(
                new Date(sos.shift.date),
                "EEEE, dd. MMMM yyyy",
                { locale: de },
              );
              const hasBonus = sos.bonusAmount && Number(sos.bonusAmount) > 0;
              const minutesLeft = Math.max(
                0,
                Math.round(
                  (new Date(sos.expiresAt).getTime() - Date.now()) / 60000,
                ),
              );

              return (
                <div>
                  {/* Greeting */}
                  <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                      Hallo {formatName(employee.firstName)},
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 mt-1">
                      deine Hilfe wird dringend benötigt.
                    </p>
                  </div>

                  {/* Shift details */}
                  <dl className="px-6 py-4 space-y-3">
                    <InfoRow label="Datum" value={shiftDate} />
                    <InfoRow
                      label="Uhrzeit"
                      value={`${sos.shift.startTime} – ${sos.shift.endTime} Uhr`}
                    />
                    {sos.shift.location && (
                      <InfoRow
                        label="Standort"
                        value={sos.shift.location.name}
                      />
                    )}
                    {hasBonus && (
                      <InfoRow
                        label="Bonus"
                        value={`${Number(sos.bonusAmount).toFixed(2)} ${sos.bonusCurrency}${sos.bonusNote ? ` – ${sos.bonusNote}` : ""}`}
                        highlight
                      />
                    )}
                    <div className="pt-1 border-t border-gray-100 dark:border-zinc-800 mt-3">
                      <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">
                        Gültigkeit
                      </p>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-0.5">
                        {minutesLeft} Minuten verbleibend
                      </p>
                    </div>
                  </dl>

                  {/* CTA buttons */}
                  <div className="px-6 pb-6 space-y-2">
                    <button
                      onClick={() => respond("accept")}
                      disabled={submitting}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors text-center"
                    >
                      {submitting ? "Wird gesendet…" : "Ja, Schicht übernehmen"}
                    </button>
                    <button
                      onClick={() => respond("decline")}
                      disabled={submitting}
                      className="w-full rounded-xl border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-60 transition-colors"
                    >
                      Nein, kann nicht
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-zinc-600 mt-6">
          Powered by <span className="font-medium">Shiftfy</span>
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 font-semibold">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium mt-0.5 ${highlight ? "text-emerald-700 dark:text-emerald-400" : "text-gray-800 dark:text-zinc-200"}`}
      >
        {value}
      </dd>
    </div>
  );
}
