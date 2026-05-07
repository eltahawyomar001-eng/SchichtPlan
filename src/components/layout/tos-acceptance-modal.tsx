"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function TosAcceptanceModal() {
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch("/api/account/accept-tos")
      .then((r) => r.json())
      .then((d: { accepted: boolean; acceptedVersion: string | null }) => {
        // Only block when the user has previously accepted some version but
        // not the current one. Brand-new sign-ups already accept on register.
        if (!d.accepted && d.acceptedVersion !== null) {
          setNeedsAcceptance(true);
        }
      })
      .catch(() => {});
  }, []);

  async function accept() {
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/account/accept-tos", { method: "POST" });
    if (res.ok) {
      setNeedsAcceptance(false);
    } else {
      setSubmitting(false);
    }
  }

  if (!needsAcceptance) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="px-6 pt-6 pb-4">
          <h2
            id="tos-modal-title"
            className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
          >
            Aktualisierte Nutzungsbedingungen
          </h2>
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
            Unsere Allgemeinen Geschäftsbedingungen und die Datenschutzerklärung
            wurden aktualisiert. Bitte lesen Sie die neuen Versionen und stimmen
            Sie zu, um Shiftfy weiter zu nutzen.
          </p>
        </div>

        <div className="px-6 pb-2">
          <div className="flex flex-col gap-2 rounded-xl bg-gray-50 dark:bg-zinc-800 p-4">
            <Link
              href="/agb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              → AGB öffnen (neuer Tab)
            </Link>
            <Link
              href="/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              → Datenschutzerklärung öffnen (neuer Tab)
            </Link>
          </div>
        </div>

        <div className="px-6 py-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-zinc-300">
              Ich habe die aktualisierten AGB und die Datenschutzerklärung
              gelesen und stimme ihnen zu.
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/auth/signout?callbackUrl=/login";
            }}
            className="flex-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Abmelden
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={!agreed || submitting}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Wird gespeichert …" : "Zustimmen"}
          </button>
        </div>
      </div>
    </div>
  );
}
