"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
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
        {/* Scope tabs */}
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
                className="h-[72px] rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-16 px-8 text-center">
            <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <AlertCircleIcon className="h-6 w-6 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              {scope === "active" ? t("emptyActive") : t("emptyRecent")}
            </p>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500 max-w-xs">
              {t("emptyHint")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/sos/${row.id}`}
                  className="flex rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
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

  const accentColor =
    row.status === "OPEN"
      ? "bg-red-500"
      : row.status === "FILLED"
        ? "bg-emerald-500"
        : "bg-zinc-300 dark:bg-zinc-600";

  return (
    <>
      {/* Left status accent strip */}
      <div className={cn("w-1 shrink-0", accentColor)} />

      <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-4">
        <StatusBadge status={row.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
            <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              {dateFmt.format(new Date(row.shift.date))}
            </p>
            <p className="text-sm font-semibold text-gray-600 dark:text-zinc-300">
              {row.shift.startTime} – {row.shift.endTime}
            </p>
            {row.shift.location?.name && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 truncate">
                <MapPinIcon className="h-3 w-3 shrink-0" />
                {row.shift.location.name}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-gray-500 dark:text-zinc-400">
            {total > 0 && (
              <span>
                {t("notifiedCount", { count: total })} ·{" "}
                {t("tier", { n: row.escalationTier })}
              </span>
            )}
            {accepted > 0 && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {t("acceptedCount", { count: accepted })}
              </span>
            )}
            {declined > 0 && (
              <span className="font-semibold text-red-500">
                {t("declinedCount", { count: declined })}
              </span>
            )}
            {row.filledBy && (
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {t("filledBy", {
                  name: `${row.filledBy.firstName} ${row.filledBy.lastName}`,
                })}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="h-4 w-4 text-gray-300 dark:text-zinc-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: SosRow["status"] }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900/40 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        OPEN
      </span>
    );
  }
  if (status === "FILLED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-900/40 shrink-0">
        <CheckCircleIcon className="h-3 w-3" />
        FILLED
      </span>
    );
  }
  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-zinc-400 ring-1 ring-gray-100 dark:ring-zinc-700 shrink-0">
        <ClockIcon className="h-3 w-3" />
        EXPIRED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-500 ring-1 ring-gray-100 dark:ring-zinc-700 shrink-0">
      CANCELLED
    </span>
  );
}
