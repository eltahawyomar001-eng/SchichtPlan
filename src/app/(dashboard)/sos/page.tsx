"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

interface SosRow {
  id: string;
  status: "OPEN" | "FILLED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  filledAt: string | null;
  expiresAt: string;
  escalationTier: number;
  bonusAmount: string | null;
  bonusCurrency: string;
  shift: {
    date: string;
    startTime: string;
    endTime: string;
    location: { name: string } | null;
  };
  filledBy: { firstName: string; lastName: string } | null;
  notifications: { response: string }[];
}

export default function SosListPage() {
  const t = useTranslations("sosModule");
  const locale = useLocale();
  const [rows, setRows] = useState<SosRow[] | null>(null);
  const [scope, setScope] = useState<"active" | "recent">("active");
  const loading = rows === null;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/sos?scope=${scope}`);
        const data = await res.json();
        if (!cancelled) setRows(data.sosRequests ?? []);
      } catch {
        if (!cancelled) setRows([]);
      }
    };

    load();

    const interval = scope === "active" ? setInterval(load, 5000) : undefined;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [scope]);

  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent>
        <div className="flex items-center gap-2">
          <ScopeTab
            label={t("scopeActive")}
            active={scope === "active"}
            onClick={() => setScope("active")}
          />
          <ScopeTab
            label={t("scopeRecent")}
            active={scope === "recent"}
            onClick={() => setScope("recent")}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <AlertCircleIcon className="h-8 w-8 mx-auto text-gray-300 dark:text-zinc-700" />
              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                {scope === "active" ? t("emptyActive") : t("emptyRecent")}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                {t("emptyHint")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/sos/${row.id}`}
                  className="block rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <SosListItem row={row} dateFmt={dateFmt} t={t} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageContent>
    </div>
  );
}

function ScopeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-emerald-600 text-white"
          : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700",
      )}
    >
      {label}
    </button>
  );
}

function SosListItem({
  row,
  dateFmt,
  t,
}: {
  row: SosRow;
  dateFmt: Intl.DateTimeFormat;
  t: ReturnType<typeof useTranslations>;
}) {
  const accepted = row.notifications.filter(
    (n) => n.response === "ACCEPTED",
  ).length;
  const declined = row.notifications.filter(
    (n) => n.response === "DECLINED",
  ).length;
  const total = row.notifications.length;

  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={row.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {dateFmt.format(new Date(row.shift.date))} · {row.shift.startTime}
            {" – "}
            {row.shift.endTime}
          </p>
          {row.shift.location?.name && (
            <span className="text-xs text-gray-400 dark:text-zinc-500 truncate">
              {row.shift.location.name}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-zinc-400">
          <span>
            {t("notifiedCount", { count: total })} ·{" "}
            {t("tier", { n: row.escalationTier })}
          </span>
          {accepted > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {t("acceptedCount", { count: accepted })}
            </span>
          )}
          {declined > 0 && (
            <span className="text-red-500 font-medium">
              {t("declinedCount", { count: declined })}
            </span>
          )}
          {row.filledBy && (
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
              {t("filledBy", {
                name: `${row.filledBy.firstName} ${row.filledBy.lastName}`,
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SosRow["status"] }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900/40">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        OPEN
      </span>
    );
  }
  if (status === "FILLED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-900/40">
        <CheckCircleIcon className="h-3 w-3" />
        FILLED
      </span>
    );
  }
  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-zinc-400 ring-1 ring-gray-100 dark:ring-zinc-700">
        <ClockIcon className="h-3 w-3" />
        EXPIRED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-500 ring-1 ring-gray-100 dark:ring-zinc-700">
      CANCELLED
    </span>
  );
}
