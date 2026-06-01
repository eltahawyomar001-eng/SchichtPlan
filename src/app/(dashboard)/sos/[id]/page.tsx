"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Button } from "@/components/ui/button";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
  ZapIcon,
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loading = data === null && error === null;

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
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
    setCancelling(true);
    try {
      const res = await fetch(`/api/sos/${data.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/sos");
      } else {
        setCancelling(false);
        setConfirmCancel(false);
      }
    } catch {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  if (error === "not_found") {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <PageContent>
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-16 px-8 text-center">
            <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <AlertCircleIcon className="h-6 w-6 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              {t("notFound")}
            </p>
            <Link
              href="/sos"
              className="mt-3 inline-block text-xs font-medium text-emerald-600 hover:underline"
            >
              {t("backToList")}
            </Link>
          </div>
        </PageContent>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <PageContent>
          <div className="h-6 w-20 rounded bg-gray-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-44 rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
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

  const totalSecs = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
  const countdownH = Math.floor(totalSecs / 3600);
  const countdownM = Math.floor((totalSecs % 3600) / 60);
  const countdownS = totalSecs % 60;

  const tierStats = [1, 2, 3].map((tier) => {
    const notifs = data.notifications.filter((n) => n.tier === tier);
    return {
      tier,
      notified: notifs.length,
      pending: notifs.filter((n) => n.response === "PENDING").length,
      accepted: notifs.filter((n) => n.response === "ACCEPTED").length,
      declined: notifs.filter((n) => n.response === "DECLINED").length,
    };
  });

  const isOpen = data.status === "OPEN";
  const isFilled = data.status === "FILLED";

  return (
    <div>
      <Topbar title={t("liveTitle")} description={t("liveDescription")} />
      <PageContent>
        {/* Back link */}
        <div className="pt-1 pb-3">
          <Link
            href="/sos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            {t("backToList")}
          </Link>
        </div>

        {/* ── STATUS BANNER ─────────────────────────────────── */}
        <div
          className={cn(
            "rounded-2xl overflow-hidden border",
            isOpen
              ? "border-red-200 dark:border-red-800/50"
              : isFilled
                ? "border-emerald-200 dark:border-emerald-800/50"
                : "border-zinc-200 dark:border-zinc-700",
          )}
        >
          {/* Accent stripe */}
          <div
            className={cn(
              "h-1",
              isOpen
                ? "bg-red-500"
                : isFilled
                  ? "bg-emerald-500"
                  : "bg-zinc-400 dark:bg-zinc-600",
            )}
          />

          <div
            className={cn(
              "px-6 py-6",
              isOpen
                ? "bg-red-50/40 dark:bg-red-950/10"
                : isFilled
                  ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                  : "bg-white dark:bg-zinc-900",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-6">
              {/* LEFT — shift details */}
              <div className="min-w-0 flex-1 space-y-4">
                <StatusHeader status={data.status} t={t} />

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-50 capitalize">
                    {shiftDate}
                  </h2>
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-gray-600 dark:text-zinc-300">
                    <ClockIcon className="h-4 w-4 text-gray-400 dark:text-zinc-500 shrink-0" />
                    {data.shift.startTime} – {data.shift.endTime}
                    {locale !== "en" ? " Uhr" : ""}
                  </div>
                  {data.shift.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                      <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                      {data.shift.location.name}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {data.bonusAmount && Number(data.bonusAmount) > 0 && (
                    <span className="inline-flex items-center rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      + {Number(data.bonusAmount).toFixed(2)}{" "}
                      {data.bonusCurrency}
                      {data.bonusNote ? ` · ${data.bonusNote}` : ""}
                    </span>
                  )}
                  {data.createdBy && (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500">
                      {locale === "en" ? "By" : "Von"}{" "}
                      {data.createdBy.name ?? data.createdBy.email}
                    </span>
                  )}
                </div>
              </div>

              {/* RIGHT — countdown or filled-by */}
              {isOpen && (
                <div className="shrink-0 rounded-xl border border-red-100 dark:border-red-900/40 bg-white dark:bg-zinc-900/80 px-5 py-4 text-center min-w-[148px]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-500 dark:text-red-400 mb-3">
                    {t("countdown")}
                  </p>
                  {totalSecs === 0 ? (
                    <p className="text-sm font-semibold text-gray-400 dark:text-zinc-500 animate-pulse">
                      {locale === "en" ? "Expiring…" : "Läuft ab…"}
                    </p>
                  ) : (
                    <>
                      <p className="text-3xl font-black tabular-nums leading-none tracking-tighter text-gray-900 dark:text-zinc-50">
                        {countdownH > 0 && (
                          <span>{String(countdownH).padStart(2, "0")}:</span>
                        )}
                        {String(countdownM).padStart(2, "0")}:
                        <span
                          className={cn(
                            "transition-colors duration-500",
                            countdownS <= 10 &&
                              countdownH === 0 &&
                              countdownM === 0
                              ? "text-red-500 dark:text-red-400"
                              : "",
                          )}
                        >
                          {String(countdownS).padStart(2, "0")}
                        </span>
                      </p>
                      <p className="mt-2 text-[9px] text-gray-400 dark:text-zinc-500 tracking-wide">
                        {countdownH > 0 ? "Std · Min · Sek" : "Min · Sek"}
                      </p>
                    </>
                  )}
                </div>
              )}

              {isFilled && data.filledBy && (
                <div className="shrink-0 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-zinc-900/80 px-4 py-4 min-w-[180px]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
                    {t("filledBadge")}
                  </p>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-white dark:ring-zinc-800"
                      style={{ background: data.filledBy.color ?? "#10b981" }}
                    >
                      {data.filledBy.firstName[0]?.toUpperCase() ?? "?"}
                      {data.filledBy.lastName[0]?.toUpperCase() ?? ""}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                        {formatPersonName(
                          data.filledBy.firstName,
                          data.filledBy.lastName,
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircleIcon className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          {locale === "en" ? "Accepted" : "Angenommen"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cancel action */}
            {isOpen && (
              <div className="mt-5 pt-4 border-t border-red-100 dark:border-red-900/30 flex items-center justify-end gap-2">
                {confirmCancel ? (
                  <>
                    <span className="text-xs text-gray-600 dark:text-zinc-400 mr-1">
                      {locale === "en"
                        ? "Are you sure?"
                        : "Wirklich abbrechen?"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                    >
                      {locale === "en" ? "No" : "Nein"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={cancelSos}
                      disabled={cancelling}
                      className="bg-red-600 hover:bg-red-700 text-white border-0"
                    >
                      {cancelling ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <XIcon className="h-3.5 w-3.5 mr-1.5" />
                          {locale === "en" ? "Yes, cancel" : "Ja, abbrechen"}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmCancel(true)}
                    disabled={cancelling}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <XIcon className="h-3.5 w-3.5 mr-1.5" />
                    {t("cancelAction")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── ESCALATION TIERS ──────────────────────────────── */}
        <section aria-labelledby="sos-escalation-heading">
          <SectionHeader
            id="sos-escalation-heading"
            label={t("escalationProgress")}
            icon={<ZapIcon className="h-3.5 w-3.5 text-amber-500" />}
          />
          <TierProgress
            tiers={tierStats}
            currentTier={data.escalationTier}
            status={data.status}
            locale={locale === "en" ? "en" : "de"}
          />
        </section>

        {/* ── AUDIT LEDGER ──────────────────────────────────── */}
        <section aria-labelledby="sos-ledger-heading">
          <SectionHeader
            id="sos-ledger-heading"
            label={t("auditLedger")}
            icon={
              <ClockIcon className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            }
          />
          <AuditLedger
            events={data.events}
            locale={locale === "en" ? "en" : "de"}
          />
        </section>

        {/* ── NOTIFICATION ROSTER ───────────────────────────── */}
        {data.notifications.length > 0 && (
          <section aria-labelledby="sos-roster-heading" className="pb-24">
            <SectionHeader
              id="sos-roster-heading"
              label={t("roster")}
              count={data.notifications.length}
              icon={
                <UsersIcon className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
              }
            />
            <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                {data.notifications.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: n.employee.color ?? "#94a3b8" }}
                    >
                      {n.employee.firstName[0]?.toUpperCase() ?? "?"}
                      {n.employee.lastName[0]?.toUpperCase() ?? ""}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">
                        {formatPersonName(
                          n.employee.firstName,
                          n.employee.lastName,
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">
                          Tier {n.tier}
                        </span>
                        {n.linkOpenedAt && (
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                            · {t("linkOpened")}
                          </span>
                        )}
                      </div>
                    </div>
                    <RosterBadge response={n.response} t={t} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </PageContent>
    </div>
  );
}

function SectionHeader({
  id,
  label,
  icon,
  count,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-0.5 pb-2.5">
      {icon}
      <h3
        id={id}
        className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400"
      >
        {label}
        {count !== undefined && (
          <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-400 dark:text-zinc-500">
            ({count})
          </span>
        )}
      </h3>
    </div>
  );
}

function formatPersonName(first: string, last: string): string {
  const cap = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  return [cap(first), cap(last)].filter(Boolean).join(" ");
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
      <span className="inline-flex items-center rounded-md border border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">
        {t("statusPending")}
      </span>
    );
  if (response === "ACCEPTED")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
        <CheckCircleIcon className="h-3 w-3" />
        {t("statusAccepted")}
      </span>
    );
  if (response === "DECLINED")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 shrink-0">
        <XIcon className="h-3 w-3" />
        {t("statusDeclined")}
      </span>
    );
  return (
    <span className="text-[10px] text-gray-400 dark:text-zinc-500">—</span>
  );
}
