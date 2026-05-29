"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  LinkIcon,
  ClockIcon,
} from "@/components/icons";

interface DatevStatus {
  connected: boolean;
  expired?: boolean;
  expiresAt?: string;
  scope?: string;
  sandbox?: boolean;
  connectedAt?: string;
  lastRefreshed?: string;
}

function fmt(d?: string): string {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE");
}

export function DATEVConnectCard() {
  const t = useTranslations("datevConnect");
  const [status, setStatus] = useState<DatevStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/datev-status");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // After returning from DATEV OAuth, the URL has ?datev=connected etc.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const result = p.get("datev");
    const detail = p.get("detail");
    if (result) {
      fetchStatus();
      if (result !== "connected") {
        const msg = detail ? decodeURIComponent(detail) : result;
        alert(`DATEV Fehler: ${msg}`);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatus]);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/compliance/datev-status", { method: "DELETE" });
      setStatus({ connected: false });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-emerald-600" />
          {t("title")}
          {status?.sandbox && (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              Sandbox
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {status.expired ? (
                <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {status.expired ? t("statusExpired") : t("statusConnected")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                {t("tokenExpires")}: {fmt(status.expiresAt)}
              </span>
              <span>
                {t("connectedOn")}: {fmt(status.connectedAt)}
              </span>
              {status.scope && (
                <span className="col-span-2 font-mono text-xs">
                  {t("scope")}: {status.scope}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {status.expired && (
                <Button
                  size="sm"
                  onClick={() =>
                    (window.location.href = "/api/auth/datev/connect")
                  }
                >
                  {t("reconnect")}
                </Button>
              )}
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
              onClick={() => (window.location.href = "/api/auth/datev/connect")}
            >
              <LinkIcon className="h-4 w-4" />
              {t("connect")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
