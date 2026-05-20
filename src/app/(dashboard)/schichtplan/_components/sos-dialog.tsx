"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";

interface SosNotification {
  id: string;
  employeeId: string;
  tier: number;
  response: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  respondedAt: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    color: string | null;
  };
}

interface SosData {
  id: string;
  status: "OPEN" | "FILLED" | "CANCELLED" | "EXPIRED";
  bonusAmount: string | null;
  bonusCurrency: string;
  bonusNote: string | null;
  expiresAt: string;
  escalationTier: number;
  createdAt: string;
  filledBy: {
    id: string;
    firstName: string;
    lastName: string;
    color: string | null;
  } | null;
  shift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    location: { name: string } | null;
  };
  notifications: SosNotification[];
}

interface ShiftInfo {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: { name: string } | null;
  employeeId?: string | null;
}

interface Props {
  shift: ShiftInfo;
  open: boolean;
  onClose: () => void;
}

export function SosDialog({ shift, open, onClose }: Props) {
  const t = useTranslations("sos");
  const locale = useLocale();
  const dfnsLocale = locale === "en" ? enUS : de;

  const [phase, setPhase] = useState<"config" | "live">("config");
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [launching, setLaunching] = useState(false);
  const [sosId, setSosId] = useState<string | null>(null);
  const [sosData, setSosData] = useState<SosData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/sos/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setSosData(data.sos);
        if (data.sos.status !== "OPEN") stopPolling();
      } catch {
        // network blip — keep polling
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    if (phase === "live" && sosId) {
      fetchStatus(sosId);
      pollRef.current = setInterval(() => fetchStatus(sosId), 3000);
    }
    return stopPolling;
  }, [phase, sosId, fetchStatus, stopPolling]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPhase("config");
      setBonusEnabled(false);
      setBonusAmount("");
      setBonusNote("");
      setSosId(null);
      setSosData(null);
      setError(null);
      stopPolling();
    }
  }, [open, stopPolling]);

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          bonusAmount:
            bonusEnabled && bonusAmount ? parseFloat(bonusAmount) : null,
          bonusCurrency: "EUR",
          bonusNote: bonusEnabled && bonusNote ? bonusNote : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error === "ALREADY_OPEN") {
          setSosId(json.sosRequestId);
          setPhase("live");
          return;
        }
        setError(json.error || "Fehler beim Starten");
        return;
      }

      setSosId(json.sosRequestId);
      setPhase("live");
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLaunching(false);
    }
  };

  const handleCancel = async () => {
    if (!sosId) return;
    await fetch(`/api/sos/${sosId}`, { method: "DELETE" });
    onClose();
  };

  if (!open) return null;

  const shiftDate = format(new Date(shift.date), "EEEE, dd. MMMM", {
    locale: dfnsLocale,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-red-50 dark:bg-red-950/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
                {t.has("title") ? t("title") : "SOS – Notfall-Schichtbesetzung"}
              </h2>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                {shiftDate} · {shift.startTime} – {shift.endTime}
                {shift.location?.name ? ` · ${shift.location.name}` : ""}
              </p>
            </div>
          </div>
        </div>

        {phase === "config" && (
          <div className="p-6 space-y-5">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              {t.has("configDesc")
                ? t("configDesc")
                : "Mitarbeiter werden sofort benachrichtigt und können die Schicht per Push oder E-Mail annehmen."}
            </p>

            {/* Bonus toggle */}
            <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.has("bonus") ? t("bonus") : "Bonus anbieten"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {t.has("bonusDesc")
                      ? t("bonusDesc")
                      : "Optionale Sondervergütung für diesen Einsatz"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bonusEnabled}
                  onClick={() => setBonusEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${bonusEnabled ? "bg-emerald-600" : "bg-gray-200 dark:bg-zinc-700"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${bonusEnabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>

              {bonusEnabled && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-zinc-400">
                      €
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={bonusNote}
                    onChange={(e) => setBonusNote(e.target.value)}
                    placeholder={
                      t.has("bonusNotePlaceholder")
                        ? t("bonusNotePlaceholder")
                        : 'Notiz (optional, z.B. "Nachtzuschlag")'
                    }
                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                {t.has("cancel") ? t("cancel") : "Abbrechen"}
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {launching
                  ? "…"
                  : t.has("launch")
                    ? t("launch")
                    : "🚨 SOS starten"}
              </button>
            </div>
          </div>
        )}

        {phase === "live" && (
          <SosLiveBoard
            sosData={sosData}
            onCancel={handleCancel}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function SosLiveBoard({
  sosData,
  onCancel,
  onClose,
}: {
  sosData: SosData | null;
  onCancel: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("sos");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!sosData) {
    return (
      <div className="p-6 text-center text-sm text-gray-500 dark:text-zinc-400 animate-pulse">
        {t.has("launching") ? t("launching") : "Starte SOS…"}
      </div>
    );
  }

  const isFilled = sosData.status === "FILLED";
  const isClosed = sosData.status !== "OPEN";

  const pending = sosData.notifications.filter(
    (n) => n.response === "PENDING",
  ).length;
  const accepted = sosData.notifications.filter(
    (n) => n.response === "ACCEPTED",
  ).length;
  const declined = sosData.notifications.filter(
    (n) => n.response === "DECLINED",
  ).length;
  const total = sosData.notifications.length;

  const expiresAt = new Date(sosData.expiresAt);
  const minutesLeft = Math.max(
    0,
    Math.round((expiresAt.getTime() - now) / 60000),
  );

  return (
    <div className="p-6 space-y-5">
      {/* Status banner */}
      {isFilled && sosData.filledBy ? (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {t.has("filled") ? t("filled") : "Schicht besetzt!"}
          </p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
            {sosData.filledBy.firstName} {sosData.filledBy.lastName}
          </p>
        </div>
      ) : isClosed ? (
        <div className="rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-4 text-center">
          <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">
            {sosData.status === "EXPIRED"
              ? t.has("expired")
                ? t("expired")
                : "SOS abgelaufen – niemand hat angenommen"
              : t.has("cancelled")
                ? t("cancelled")
                : "SOS abgebrochen"}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-red-500">●</span>
            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
              {t.has("live") ? t("live") : "Live"}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            {minutesLeft}m {t.has("remaining") ? t("remaining") : "übrig"} ·
            Tier {sosData.escalationTier}/3
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatBox
          label={t.has("notified") ? t("notified") : "Benachrichtigt"}
          value={total}
          color="gray"
        />
        <StatBox
          label={t.has("pending") ? t("pending") : "Ausstehend"}
          value={pending}
          color="amber"
        />
        <StatBox
          label={t.has("declined") ? t("declined") : "Abgelehnt"}
          value={declined}
          color="red"
        />
      </div>

      {/* Employee list */}
      {sosData.notifications.length > 0 && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {sosData.notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: n.employee.color ?? "#94a3b8" }}
                />
                <span className="text-sm text-gray-800 dark:text-zinc-200">
                  {n.employee.firstName} {n.employee.lastName}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                  T{n.tier}
                </span>
              </div>
              <ResponseBadge response={n.response} />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!isClosed && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            {t.has("cancelSos") ? t("cancelSos") : "SOS abbrechen"}
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-gray-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
        >
          {t.has("close") ? t("close") : "Schließen"}
        </button>
      </div>

      {accepted > 0 && !isFilled && (
        <p className="text-xs text-center text-gray-400 dark:text-zinc-500">
          {t.has("acceptedNote")
            ? t("acceptedNote")
            : "Zuordnung wird verarbeitet…"}
        </p>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    gray: "text-gray-700 dark:text-zinc-300",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-zinc-800 py-2 px-1">
      <p
        className={`text-xl font-bold tabular-nums ${colorMap[color] ?? colorMap.gray}`}
      >
        {value}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
        {label}
      </p>
    </div>
  );
}

function ResponseBadge({
  response,
}: {
  response: SosNotification["response"];
}) {
  if (response === "PENDING")
    return (
      <span className="text-[10px] font-medium text-amber-500 animate-pulse">
        ●
      </span>
    );
  if (response === "ACCEPTED")
    return (
      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        ✓ Ja
      </span>
    );
  if (response === "DECLINED")
    return <span className="text-[10px] font-medium text-red-500">✗ Nein</span>;
  return (
    <span className="text-[10px] text-gray-400 dark:text-zinc-500">—</span>
  );
}
