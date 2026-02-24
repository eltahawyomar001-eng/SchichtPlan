"use client";

/**
 * CookieBanner — DSGVO / TDDDG (§ 25) compliant cookie consent banner.
 *
 * Layout modeled after clockin.de and common German SaaS patterns:
 *   1. Banner appears at the bottom on first visit.
 *   2. Three buttons: "Alle akzeptieren" / "Nur Notwendige" / "Einstellungen".
 *   3. Settings panel exposes granular category toggles.
 *   4. "Cookie Einstellungen" link in footer re-opens the panel.
 *
 * Legal references:
 *   - § 25 TDDDG (Telemedien-Datenschutz-Gesetz, formerly TTDSG)
 *   - Art. 6 (1)(a), Art. 7 DSGVO — consent
 *   - ePrivacy Directive (2002/58/EC) — cookie consent
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type CookieConsent,
  getStoredConsent,
  saveConsent,
  acceptAll,
  rejectAll,
  CONSENT_VERSION,
} from "@/lib/cookie-consent";

export function CookieBanner() {
  const t = useTranslations("cookieBanner");

  // Use lazy initializers to avoid setState-in-effect (react-hooks/set-state-in-effect)
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !getStoredConsent();
  });
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(() => {
    if (typeof window === "undefined") return false;
    return getStoredConsent()?.analytics ?? false;
  });
  const [marketing, setMarketing] = useState(() => {
    if (typeof window === "undefined") return false;
    return getStoredConsent()?.marketing ?? false;
  });

  useEffect(() => {
    // Allow re-opening from footer "Cookie Einstellungen" link
    const handleOpen = () => {
      const stored = getStoredConsent();
      if (stored) {
        setAnalytics(stored.analytics);
        setMarketing(stored.marketing);
      }
      setShowSettings(true);
      setVisible(true);
    };
    window.addEventListener("open-cookie-settings", handleOpen);
    return () => window.removeEventListener("open-cookie-settings", handleOpen);
  }, []);

  const handleAcceptAll = useCallback(() => {
    acceptAll();
    setVisible(false);
    setShowSettings(false);
  }, []);

  const handleRejectAll = useCallback(() => {
    rejectAll();
    setVisible(false);
    setShowSettings(false);
  }, []);

  const handleSaveSettings = useCallback(() => {
    const consent: CookieConsent = {
      necessary: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(consent);
    setVisible(false);
    setShowSettings(false);
  }, [analytics, marketing]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-[9999] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/10">
        {/* ── Main banner ── */}
        {!showSettings && (
          <div className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">
              {t("title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {t("description")}{" "}
              <Link
                href="/datenschutz"
                className="underline hover:text-emerald-600 transition-colors"
              >
                {t("privacyLink")}
              </Link>
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {t("settings")}
              </button>
              <button
                onClick={handleRejectAll}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {t("rejectAll")}
              </button>
              <button
                onClick={handleAcceptAll}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {t("acceptAll")}
              </button>
            </div>
          </div>
        )}

        {/* ── Settings panel ── */}
        {showSettings && (
          <div className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">
              {t("settingsTitle")}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              {t("settingsDescription")}
            </p>

            <div className="mt-5 space-y-4">
              {/* Necessary — always on */}
              <CookieCategory
                label={t("necessary")}
                description={t("necessaryDesc")}
                checked={true}
                disabled={true}
                onChange={() => {}}
              />

              {/* Analytics */}
              <CookieCategory
                label={t("analytics")}
                description={t("analyticsDesc")}
                checked={analytics}
                disabled={false}
                onChange={setAnalytics}
              />

              {/* Marketing */}
              <CookieCategory
                label={t("marketing")}
                description={t("marketingDesc")}
                checked={marketing}
                disabled={false}
                onChange={setMarketing}
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {t("back")}
              </button>
              <button
                onClick={handleSaveSettings}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {t("saveSettings")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Cookie Settings Footer Link ── */
export function CookieSettingsButton() {
  const t = useTranslations("cookieBanner");

  return (
    <button
      onClick={() =>
        window.dispatchEvent(new CustomEvent("open-cookie-settings"))
      }
      className="hover:text-gray-600 transition-colors cursor-pointer"
    >
      {t("footerLink")}
    </button>
  );
}

/* ── Category Toggle ── */
function CookieCategory({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `cookie-cat-${label.toLowerCase().replace(/\s/g, "-")}`;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 sm:p-4">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-900 cursor-pointer"
        >
          {label}
          {disabled && (
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 uppercase">
              Erforderlich
            </span>
          )}
        </label>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
          focus:ring-emerald-500 focus:ring-offset-2
          ${checked ? "bg-emerald-600" : "bg-gray-200"}
          ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}
