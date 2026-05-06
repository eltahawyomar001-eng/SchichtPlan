"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface UsageMetric {
  used: number;
  limit: number | null;
}

interface UsageData {
  employees: UsageMetric;
  locations: UsageMetric;
  storageMb: UsageMetric;
  pdfsThisMonth: UsageMetric;
  ticketsThisMonth: UsageMetric;
  emailsThisMonth: UsageMetric;
}

function pct(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function barColor(percent: number): string {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function formatLimit(limit: number | null, t: (k: string) => string): string {
  return limit === null ? t("unlimited") : limit.toLocaleString();
}

function MetricRow({
  label,
  used,
  limit,
  unit,
  t,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
  t: (k: string) => string;
}) {
  const percent = pct(used, limit);
  const usedLabel = unit
    ? `${used.toLocaleString()} ${unit}`
    : used.toLocaleString();
  const limitLabel = unit
    ? `${formatLimit(limit, t)} ${limit !== null ? unit : ""}`.trim()
    : formatLimit(limit, t);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {usedLabel}
          <span className="text-gray-400 dark:text-gray-500"> / </span>
          {limitLabel}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${barColor(percent)}`}
          style={{
            width: limit === null ? "8%" : `${Math.max(percent, 2)}%`,
            opacity: limit === null ? 0.4 : 1,
          }}
        />
      </div>
    </div>
  );
}

export function UsageDashboard() {
  const t = useTranslations("billing");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsageData | null) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("usageTitle")}</CardTitle>
          <CardDescription>{t("usageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("usageTitle")}</CardTitle>
        <CardDescription>{t("usageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 sm:grid-cols-2">
          <MetricRow
            label={t("usageEmployees")}
            used={data.employees.used}
            limit={data.employees.limit}
            t={t}
          />
          <MetricRow
            label={t("usageLocations")}
            used={data.locations.used}
            limit={data.locations.limit}
            t={t}
          />
          <MetricRow
            label={t("usageStorage")}
            used={data.storageMb.used}
            limit={data.storageMb.limit}
            unit="MB"
            t={t}
          />
          <MetricRow
            label={t("usagePdfs")}
            used={data.pdfsThisMonth.used}
            limit={data.pdfsThisMonth.limit}
            t={t}
          />
          {data.ticketsThisMonth.limit !== null && (
            <MetricRow
              label={t("usageTickets")}
              used={data.ticketsThisMonth.used}
              limit={data.ticketsThisMonth.limit}
              t={t}
            />
          )}
          {data.emailsThisMonth?.limit !== null && (
            <MetricRow
              label={t("usageEmails")}
              used={data.emailsThisMonth?.used ?? 0}
              limit={data.emailsThisMonth?.limit ?? null}
              t={t}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
