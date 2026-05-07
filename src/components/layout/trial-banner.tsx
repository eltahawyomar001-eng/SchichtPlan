"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { XIcon } from "@/components/icons";

const DISMISS_KEY = "trial_banner_dismissed_v1";

export function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    fetch("/api/billing/trial-status")
      .then((r) => r.json())
      .then((data: { isTrialing: boolean; daysLeft: number }) => {
        if (data.isTrialing) {
          setDaysLeft(data.daysLeft);
          setDismissed(false);
        }
      })
      .catch(() => {});
  }, []);

  if (dismissed || daysLeft === null) return null;

  const urgency = daysLeft <= 2;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
        urgency ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
      }`}
    >
      <span>
        {daysLeft === 0
          ? "Ihr Testzeitraum endet heute."
          : daysLeft === 1
            ? "Noch 1 Tag Testzeitraum übrig."
            : `Noch ${daysLeft} Tage Testzeitraum übrig.`}{" "}
        <Link
          href="/einstellungen/abonnement"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Jetzt upgraden
        </Link>
      </span>
      <button
        type="button"
        aria-label="Banner schließen"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="flex-shrink-0 rounded p-0.5 opacity-80 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
