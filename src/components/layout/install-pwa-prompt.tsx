"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon, SmartphoneIcon, XIcon } from "@/components/icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 14;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(DISMISS_KEY);
  if (!val) return false;
  const dismissedAt = Number(val);
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

/**
 * Smart PWA install prompt.
 * - Android/Chrome/Edge: intercepts `beforeinstallprompt` → shows native install dialog
 * - iOS Safari: shows manual instructions (Share → Add to Home Screen)
 * - Already installed or dismissed: hidden
 */
export function InstallPwaPrompt() {
  const t = useTranslations("pwa");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  // Listen for beforeinstallprompt (Android/Chrome/Edge)
  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // iOS: show guide after short delay if not installed/dismissed
  useEffect(() => {
    if (isStandalone() || isDismissed()) return;
    if (isIos()) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      }
      setDeferredPrompt(null);
    } else if (isIos()) {
      setShowIosGuide(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    dismiss();
    setVisible(false);
    setShowIosGuide(false);
  }, []);

  if (!visible) return null;

  // iOS instruction bottom-sheet
  if (showIosGuide) {
    return (
      <>
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={handleDismiss}
        />
        <div className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl bg-white shadow-xl animate-slide-up">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-gray-300" />
          </div>

          <div className="px-5 pb-6 pt-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                {t("iosTitle")}
              </h3>
              <button
                onClick={handleDismiss}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 flex-shrink-0">
                  1
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("iosStep1")}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("iosStep1Desc")}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 flex-shrink-0">
                  2
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("iosStep2")}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("iosStep2Desc")}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 flex-shrink-0">
                  3
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("iosStep3")}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("iosStep3Desc")}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              {t("understood")}
            </button>
          </div>

          {/* Safe area bottom */}
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      </>
    );
  }

  // Install banner (Android/Chrome or iOS initial prompt)
  return (
    <div className="fixed bottom-4 inset-x-4 z-[60] sm:inset-x-auto sm:right-4 sm:left-auto sm:w-80 rounded-2xl border border-gray-200 bg-white shadow-xl p-4 animate-slide-up mb-[env(safe-area-inset-bottom)]">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 p-2.5 flex-shrink-0">
          <SmartphoneIcon className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{t("title")}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t("description")}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0 -mt-0.5 -mr-1"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleDismiss}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {t("later")}
        </button>
        <button
          onClick={handleInstall}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          {t("install")}
        </button>
      </div>
    </div>
  );
}
