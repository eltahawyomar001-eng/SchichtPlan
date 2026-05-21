"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { AlertCircleIcon } from "@/components/icons";

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

/**
 * SOS launch dialog — collects optional bonus config, then redirects
 * to the standalone live control room at /sos/[id]. Live tracking,
 * audit ledger, and tier visualizer all live in that module.
 */
export function SosDialog({ shift, open, onClose }: Props) {
  const t = useTranslations("sos");
  const locale = useLocale();
  const router = useRouter();
  const dfnsLocale = locale === "en" ? enUS : de;

  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setBonusEnabled(false);
      setBonusAmount("");
      setBonusNote("");
      setError(null);
    }
  }, [open]);

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
          onClose();
          router.push(`/sos/${json.sosRequestId}`);
          return;
        }
        setError(json.error || "Fehler beim Starten");
        return;
      }

      onClose();
      router.push(`/sos/${json.sosRequestId}`);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLaunching(false);
    }
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
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-red-50 dark:bg-red-950/30">
          <div className="flex items-center gap-3">
            <AlertCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
                {t("title")}
              </h2>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                {shiftDate} · {shift.startTime} – {shift.endTime}
                {shift.location?.name ? ` · ${shift.location.name}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {t("configDesc")}
          </p>

          {/* Bonus toggle */}
          <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {t("bonus")}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  {t("bonusDesc")}
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
                  placeholder={t("bonusNotePlaceholder")}
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
              {t("cancel")}
            </button>
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {launching ? t("launching") : t("launch")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
