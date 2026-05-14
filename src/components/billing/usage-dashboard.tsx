"use client";

import { useCallback, useEffect, useState } from "react";
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

/**
 * Custom event name fired by employee/location/invitation CRUD pages to
 * tell every mounted UsageDashboard to re-fetch. Use:
 *   window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));
 * after a successful CRUD response.
 */
export const USAGE_CHANGED_EVENT = "shiftfy:usage-changed";

export function UsageDashboard() {
  const t = useTranslations("billing");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // cache: "no-store" — usage counts must reflect the live DB on every
      // fetch, never a stale CDN/SW cache.
      const res = await fetch("/api/billing/usage", { cache: "no-store" });
      const d = res.ok ? ((await res.json()) as UsageData) : null;
      setData(d);
    } catch {
      // leave previous data on transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Refresh whenever the tab regains focus (covers most "I added an
    // employee in another tab, come back to billing" cases).
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    // Refresh on broadcast from CRUD pages in the same tab.
    const onUsageChanged = () => load();
    window.addEventListener(USAGE_CHANGED_EVENT, onUsageChanged);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(USAGE_CHANGED_EVENT, onUsageChanged);
    };
  }, [load]);

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
