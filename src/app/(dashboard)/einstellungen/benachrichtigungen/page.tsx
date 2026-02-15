"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellIcon, MailIcon, ChevronLeftIcon } from "@/components/icons";
import Link from "next/link";

export default function BenachrichtigungenPage() {
  const t = useTranslations("notificationPrefs");

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [loading, setLoading] = useState(true);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-preferences");
      if (res.ok) {
        const data = await res.json();
        setEmailEnabled(data.emailEnabled);
      }
    } catch {
      console.error("Failed to fetch notification preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  async function toggleEmail() {
    const newValue = !emailEnabled;
    setEmailEnabled(newValue);
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailEnabled: newValue }),
      });

      if (res.ok) {
        const data = await res.json();
        setEmailEnabled(data.emailEnabled);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setEmailEnabled(!newValue);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setEmailEnabled(!newValue);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="p-4 sm:p-6 max-w-3xl">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-40 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        {/* Back link */}
        <Link
          href="/einstellungen"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t("backToSettings")}
        </Link>

        {/* Summary banner */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <BellIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {t("emailNotifications")}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t("subtitle")}</p>
          </div>
          {saveStatus !== "idle" && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                saveStatus === "saving"
                  ? "text-amber-700 bg-amber-100"
                  : saveStatus === "saved"
                    ? "text-emerald-700 bg-emerald-100"
                    : "text-red-700 bg-red-100"
              }`}
            >
              {t(saveStatus)}
            </span>
          )}
        </div>

        {/* Email toggle */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailIcon className="h-5 w-5 text-blue-600" />
              {t("email")}
            </CardTitle>
            <CardDescription>{t("emailDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 pt-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge
                  variant={emailEnabled ? "default" : "outline"}
                  className={`text-[10px] px-1.5 py-0 ${
                    emailEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {emailEnabled ? t("enabled") : t("disabled")}
                </Badge>
              </div>
            </div>

            {/* Toggle switch */}
            <button
              onClick={toggleEmail}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 flex-shrink-0 cursor-pointer ${
                emailEnabled ? "bg-blue-600" : "bg-gray-200"
              }`}
              aria-label="Toggle email notifications"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  emailEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="border-blue-100">
          <CardContent className="p-4">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs text-blue-700">{t("emailInfo")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
