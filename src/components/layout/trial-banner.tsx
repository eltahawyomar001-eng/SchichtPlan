"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { XIcon } from "@/components/icons";

const TRIAL_DISMISS_KEY = "trial_banner_dismissed_v1";

interface BillingState {
  isTrialing: boolean;
  daysLeft: number;
  isPastDue: boolean;
}

export function TrialBanner() {
  const [state, setState] = useState<BillingState | null>(null);
  const [trialDismissed, setTrialDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.sessionStorage.getItem(TRIAL_DISMISS_KEY));
  });

  useEffect(() => {
    fetch("/api/billing/trial-status")
      .then((r) => r.json())
      .then((data: BillingState) => setState(data))
      .catch(() => {});
  }, []);

  if (!state) return null;

  // PAST_DUE banner is non-dismissable — payment must be fixed.
  if (state.isPastDue) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white"
      >
        <span>
          Ihre letzte Zahlung ist fehlgeschlagen.{" "}
          <Link
            href="/einstellungen/abonnement"
            className="underline underline-offset-2 font-semibold hover:opacity-90 transition-opacity"
          >
            Zahlungsmethode aktualisieren
          </Link>
        </span>
      </div>
    );
  }

  if (!state.isTrialing || trialDismissed) return null;

  const urgency = state.daysLeft <= 2;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
        urgency ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
      }`}
    >
      <span>
        {state.daysLeft === 0
          ? "Ihr Testzeitraum endet heute."
          : state.daysLeft === 1
            ? "Noch 1 Tag Testzeitraum übrig."
            : `Noch ${state.daysLeft} Tage Testzeitraum übrig.`}{" "}
        <Link
          href="/einstellungen/abonnement#pricing"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Jetzt upgraden
        </Link>
      </span>
      <button
        type="button"
        aria-label="Banner schließen"
        onClick={() => {
          sessionStorage.setItem(TRIAL_DISMISS_KEY, "1");
          setTrialDismissed(true);
        }}
        className="flex-shrink-0 rounded p-0.5 opacity-80 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
