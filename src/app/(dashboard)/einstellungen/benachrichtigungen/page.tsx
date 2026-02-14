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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BellIcon,
  MailIcon,
  MessageCircleIcon,
  SmartphoneIcon,
  ChevronLeftIcon,
} from "@/components/icons";
import Link from "next/link";

interface ChannelConfig {
  key: string;
  labelKey: string;
  descKey: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
  needsPhone: boolean;
}

const CHANNELS: ChannelConfig[] = [
  {
    key: "EMAIL",
    labelKey: "email",
    descKey: "emailDesc",
    icon: MailIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    needsPhone: false,
  },
  {
    key: "WHATSAPP",
    labelKey: "whatsapp",
    descKey: "whatsappDesc",
    icon: MessageCircleIcon,
    color: "text-green-600",
    bgColor: "bg-green-50",
    needsPhone: true,
  },
  {
    key: "SMS",
    labelKey: "sms",
    descKey: "smsDesc",
    icon: SmartphoneIcon,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    needsPhone: true,
  },
];

export default function BenachrichtigungenPage() {
  const t = useTranslations("notificationPrefs");

  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    EMAIL: false,
    WHATSAPP: false,
    SMS: false,
  });
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [loading, setLoading] = useState(true);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-preferences");
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
        setPhone(data.phone);
        setPhoneSaved(data.phone);
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

  async function toggleChannel(channel: string, enabled: boolean) {
    // Optimistic update
    setPreferences((prev) => ({ ...prev, [channel]: enabled }));
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, enabled }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        // Revert on error
        setPreferences((prev) => ({ ...prev, [channel]: !enabled }));
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setPreferences((prev) => ({ ...prev, [channel]: !enabled }));
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  async function savePhone() {
    if (phone === phoneSaved) return;
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (res.ok) {
        const data = await res.json();
        setPhone(data.phone);
        setPhoneSaved(data.phone);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  const enabledCount = Object.values(preferences).filter(Boolean).length;

  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="p-4 sm:p-6 max-w-3xl">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-40 bg-gray-100 rounded-xl" />
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
              {enabledCount > 0
                ? `${enabledCount}/3 ${t("channels").toLowerCase()}`
                : t("noChannels")}
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

        {/* Phone number input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SmartphoneIcon className="h-5 w-5 text-gray-400" />
              {t("phone")}
            </CardTitle>
            <CardDescription>{t("phoneHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="phone" className="sr-only">
                  {t("phone")}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t("phonePlaceholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={savePhone}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Channel toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {t("channels")}
          </h3>

          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const enabled = preferences[ch.key] ?? false;
            const needsPhoneButMissing = ch.needsPhone && !phoneSaved;

            return (
              <Card key={ch.key} className="relative overflow-hidden">
                <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                  <div className={`rounded-xl p-3 ${ch.bgColor} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${ch.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {t(ch.labelKey)}
                      </p>
                      <Badge
                        variant={enabled ? "default" : "outline"}
                        className={`text-[10px] px-1.5 py-0 ${
                          enabled
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {enabled ? t("enabled") : t("disabled")}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t(ch.descKey)}
                      {needsPhoneButMissing && (
                        <span className="text-amber-600 ml-1">
                          ({t("phone")} !)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleChannel(ch.key, !enabled)}
                    disabled={needsPhoneButMissing}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 flex-shrink-0 ${
                      enabled ? "bg-blue-600" : "bg-gray-200"
                    } ${needsPhoneButMissing ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    aria-label={`Toggle ${t(ch.labelKey)}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
