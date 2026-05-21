"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  MapPinIcon,
  XIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { TierProgress } from "../_components/tier-progress";
import { AuditLedger } from "../_components/audit-ledger";

interface SosData {
  id: string;
  status: "OPEN" | "FILLED" | "CANCELLED" | "EXPIRED";
  bonusAmount: string | null;
  bonusCurrency: string;
  bonusNote: string | null;
  expiresAt: string;
  escalationTier: number;
  createdAt: string;
  filledBy: {
    id: string;
    firstName: string;
    lastName: string;
    color: string | null;
  } | null;
  shift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    location: { name: string } | null;
  };
  notifications: {
    id: string;
    employeeId: string;
    tier: number;
    response: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
    notifiedAt: string;
    respondedAt: string | null;
    linkOpenedAt: string | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      color: string | null;
    };
  }[];
  events: {
    id: string;
    type:
      | "CREATED"
      | "RANKED"
      | "TIER_NOTIFIED"
      | "LINK_OPENED"
      | "ACCEPTED"
      | "DECLINED"
      | "ESCALATED"
      | "FILLED"
      | "EXPIRED"
      | "CANCELLED";
    actorType: "SYSTEM" | "USER" | "EMPLOYEE";
    actorId: string | null;
    actorName: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }[];
  createdBy: { name: string | null; email: string } | null;
}

export default function SosLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("sosModule");
  const [data, setData] = useState<SosData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loading = data === null && error === null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch(`/api/sos/${id}`);
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? "not_found" : "error");
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json.sos);
          if (json.sos.status !== "OPEN" && interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch {
        if (!cancelled) setError("network");
      }
    }

    load();
    interval = setInterval(load, 3000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [id]);

  async function cancelSos() {
    if (!data) return;
    if (
      !window.confirm(
        locale === "en"
          ? "Cancel this SOS request?"
          : "Diese SOS-Anfrage wirklich abbrechen?",
      )
    ) {
      return;
    }
    setCancelling(true);
    try {
      await fetch(`/api/sos/${data.id}`, { method: "DELETE" });
      router.push("/sos");
    } catch {
      setCancelling(false);
    }
  }

  if (error === "not_found") {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <PageContent>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircleIcon className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                {t("notFound")}
              </p>
              <Link
                href="/sos"
                className="mt-3 inline-block text-xs text-emerald-600 hover:underline"
              >
                {t("backToList")}
              </Link>
            </CardContent>
          </Card>
        </PageContent>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <PageContent>
          <div className="h-24 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
        </PageContent>
      </div>
    );
  }

  const dfnsLocale = locale === "en" ? enUS : de;
  const shiftDate = format(new Date(data.shift.date), "EEEE, d. MMMM yyyy", {
    locale: dfnsLocale,
  });
  const expiresAt = new Date(data.expiresAt);
  const totalMinutes = Math.max(
    0,
    Math.round((expiresAt.getTime() - now) / 60000),
  );
  const seconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now) / 1000) % 60,
  );

  const tierStats = [1, 2, 3].map((t) => {
    const notifs = data.notifications.filter((n) => n.tier === t);
    return {
      tier: t,
      notified: notifs.length,
      pending: notifs.filter((n) => n.response === "PENDING").length,
      accepted: notifs.filter((n) => n.response === "ACCEPTED").length,
      declined: notifs.filter((n) => n.response === "DECLINED").length,
    };
  });

  return (
    <div>
      <Topbar title={t("liveTitle")} description={t("liveDescription")} />
      <PageContent>
        {/* Back nav */}
        <Link
          href="/sos"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          {t("backToList")}
        </Link>

        {/* Header card */}
        <Card
          className={cn(
            "transition-all duration-500 ease-out",
            data.status === "OPEN"
              ? "border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10"
              : data.status === "FILLED"
                ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10"
                : "border-gray-200 dark:border-zinc-700",
          )}
        >
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <StatusHeader status={data.status} t={t} />
                <h2 className="mt-2 text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                  {shiftDate}
                </h2>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-0.5">
                  {data.shift.startTime} – {data.shift.endTime}
                  {locale === "en" ? "" : " Uhr"}
                </p>
                {data.shift.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {data.shift.location.name}
                  </p>
                )}
                {data.bonusAmount && Number(data.bonusAmount) > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {t("bonus")}: {Number(data.bonusAmount).toFixed(2)}{" "}
                    {data.bonusCurrency}
                    {data.bonusNote ? ` · ${data.bonusNote}` : ""}
                  </p>
                )}
              </div>

              {data.status === "OPEN" && (
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900/40 px-4 py-3 text-center min-w-[110px]">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-red-600 dark:text-red-400">
                    {t("countdown")}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
                    {totalMinutes}
                    <span className="text-sm font-medium text-gray-400 dark:text-zinc-500">
                      m {String(seconds).padStart(2, "0")}s
                    </span>
                  </p>
                </div>
              )}

              {data.status === "FILLED" && data.filledBy && (
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("filledBadge")}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircleIcon className="h-4 w-4" />
                    {data.filledBy.firstName} {data.filledBy.lastName}
                  </p>
                </div>
              )}
            </div>

            {data.status === "OPEN" && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelSos}
                  disabled={cancelling}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <XIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t("cancelAction")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Escalation visualizer */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-2">
            {t("escalationProgress")}
          </h3>
          <TierProgress
            tiers={tierStats}
            currentTier={data.escalationTier}
            status={data.status}
          />
        </div>

        {/* Audit ledger */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-2">
            {t("auditLedger")}
          </h3>
          <AuditLedger
            events={data.events}
            locale={locale === "en" ? "en" : "de"}
          />
        </div>

        {/* Notification roster */}
        {data.notifications.length > 0 && (
          <div>
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-2">
              {t("roster")}
            </h3>
            <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                {data.notifications.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: n.employee.color ?? "#94a3b8" }}
                    />
                    <span className="text-sm font-medium text-gray-800 dark:text-zinc-200">
                      {n.employee.firstName} {n.employee.lastName}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                      T{n.tier}
                    </span>
                    {n.linkOpenedAt && (
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {t("linkOpened")}
                      </span>
                    )}
                    <span className="ml-auto">
                      <RosterBadge response={n.response} t={t} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </PageContent>
    </div>
  );
}

function StatusHeader({
  status,
  t,
}: {
  status: SosData["status"];
  t: ReturnType<typeof useTranslations>;
}) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 dark:bg-red-950/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900/40">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        {t("statusOpen")}
      </span>
    );
  }
  if (status === "FILLED") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-900/40">
        <CheckCircleIcon className="h-3 w-3" />
        {t("statusFilled")}
      </span>
    );
  }
  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-zinc-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">
        <ClockIcon className="h-3 w-3" />
        {t("statusExpired")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-zinc-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
      {t("statusCancelled")}
    </span>
  );
}

function RosterBadge({
  response,
  t,
}: {
  response: SosData["notifications"][number]["response"];
  t: ReturnType<typeof useTranslations>;
}) {
  if (response === "PENDING")
    return (
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        {t("statusPending")}
      </span>
    );
  if (response === "ACCEPTED")
    return (
      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        {t("statusAccepted")}
      </span>
    );
  if (response === "DECLINED")
    return (
      <span className="text-[10px] font-semibold text-red-500">
        {t("statusDeclined")}
      </span>
    );
  return (
    <span className="text-[10px] text-gray-400 dark:text-zinc-500">—</span>
  );
}
