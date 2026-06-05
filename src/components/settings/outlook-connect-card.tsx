"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircleIcon,
  CalendarIcon,
  MailIcon,
  ClockIcon,
} from "@/components/icons";

interface OutlookStatus {
  connected: boolean;
  configured?: boolean;
  email?: string;
  scope?: string;
  expiresAt?: string;
  connectedAt?: string;
  lastRefreshed?: string;
}

function fmt(d?: string): string {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE");
}

export function OutlookConnectCard() {
  const t = useTranslations("outlookConnect");
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/outlook/status");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // After returning from Microsoft OAuth, the URL carries ?outlook=connected etc.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const result = p.get("outlook");
    const detail = p.get("detail");
    if (result) {
      fetchStatus();
      if (result !== "connected") {
        const msg = detail ? decodeURIComponent(detail) : result;
        alert(`Outlook: ${msg}`);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatus]);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/outlook/status", { method: "DELETE" });
      setStatus({ connected: false, configured: status?.configured });
    } finally {
      setDisconnecting(false);
    }
  }

  // When the integration isn't configured on the server, don't show a connect
  // button that would just bounce — render nothing so the settings page stays
  // clean for workspaces without Outlook enabled.
  if (!loading && status && status.configured === false) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-[#0078d4]" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent" />
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {t("statusConnected")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-zinc-400">
              {status.email && (
                <span className="inline-flex items-center gap-1.5">
                  <MailIcon className="h-3.5 w-3.5 shrink-0" />
                  {status.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                {t("connectedOn")}: {fmt(status.connectedAt)}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  (window.location.href = "/api/integrations/outlook/connect")
                }
              >
                {t("reconnect")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={disconnecting}
                onClick={disconnect}
              >
                {disconnecting ? t("disconnecting") : t("disconnect")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {t("description")}
            </p>
            <Button
              size="sm"
              onClick={() =>
                (window.location.href = "/api/integrations/outlook/connect")
              }
            >
              <CalendarIcon className="h-4 w-4" />
              {t("connect")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
