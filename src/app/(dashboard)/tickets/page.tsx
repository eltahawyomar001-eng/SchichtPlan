"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PageContent } from "@/components/ui/page-content";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TicketIcon,
  PlusIcon,
  SearchIcon,
  LinkIcon,
  ClipboardIcon,
} from "@/components/icons";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { SessionUser } from "@/lib/types";
import { isManagement } from "@/lib/authorization";

// ─── Types ──────────────────────────────────────────────────────

interface TicketUser {
  id: string;
  name: string | null;
  email: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  ticketType: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  externalSubmitterName: string | null;
  createdBy: TicketUser | null;
  assignedTo: TicketUser | null;
  createdAt: string;
  updatedAt: string;
  _count: { comments: number };
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "info" | "outline"
> = {
  OFFEN: "warning",
  IN_BEARBEITUNG: "info",
  GESCHLOSSEN: "outline",
};

const PRIORITY_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "info" | "outline"
> = {
  NIEDRIG: "outline",
  MITTEL: "info",
  HOCH: "warning",
  DRINGEND: "destructive",
};

// ─── Component ──────────────────────────────────────────────────

export default function TicketsPage() {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const canManage = user ? isManagement(user) : false;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Debounce the search input — wait 400ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTickets = useCallback(async () => {
    try {
      setFetchError("");
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterAssignedToMe && user?.id) params.set("assignedToId", user.id);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data ?? data);
      } else {
        const data = await res.json().catch(() => null);
        setFetchError(
          data?.error === "NO_WORKSPACE"
            ? t("errorNoWorkspace")
            : t("errorLoading"),
        );
      }
    } catch {
      setFetchError(t("errorNetwork"));
    } finally {
      setLoading(false);
    }
  }, [
    filterStatus,
    filterCategory,
    filterAssignedToMe,
    user?.id,
    debouncedSearch,
    t,
  ]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // stats are supplementary — silent
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [fetchTickets, fetchStats]);

  // Fetch workspace slug for the public ticket link
  useEffect(() => {
    if (!canManage) return;
    (async () => {
      try {
        const res = await fetch("/api/workspace");
        if (res.ok) {
          const data = await res.json();
          const ws = data.data ?? data;
          if (ws?.slug) setWorkspaceSlug(ws.slug);
        }
      } catch {
        // silent
      }
    })();
  }, [canManage]);

  return (
    <>
      <Topbar title={t("title")} />
      <PageContent>
        {/* ── Stats Cards ────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t("stats.total")}
              value={stats.total}
              color="emerald"
            />
            <StatCard
              label={t("stats.open")}
              value={stats.byStatus.OFFEN ?? 0}
              color="amber"
            />
            <StatCard
              label={t("stats.inProgress")}
              value={stats.byStatus.IN_BEARBEITUNG ?? 0}
              color="blue"
            />
            <StatCard
              label={t("stats.closed")}
              value={stats.byStatus.GESCHLOSSEN ?? 0}
              color="gray"
            />
          </div>
        )}

        {/* ── Public Ticket Link (Admins) ────────────────── */}
        {canManage && workspaceSlug && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5">
            <LinkIcon className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-emerald-800 dark:text-emerald-300 truncate flex-1">
              {t("externalLink.label")}:{" "}
              <code className="rounded bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 text-xs font-mono text-emerald-700 dark:text-emerald-300">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/ticket/neu/${workspaceSlug}`
                  : `/ticket/neu/${workspaceSlug}`}
              </code>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={() => {
                const url = `${window.location.origin}/ticket/neu/${workspaceSlug}`;
                navigator.clipboard.writeText(url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              <ClipboardIcon className="h-3.5 w-3.5" />
              {linkCopied ? t("externalLink.copied") : t("externalLink.copy")}
            </Button>
          </div>
        )}

        {/* ── Error banner ────────────────────────────────── */}
        {fetchError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {fetchError}
            <button
              onClick={() => {
                setLoading(true);
                fetchTickets();
                fetchStats();
              }}
              className="ml-auto text-xs font-semibold underline hover:no-underline"
            >
              {tc("tryAgain")}
            </button>
          </div>
        )}

        {/* ── Toolbar ────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 sm:left-3" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-11 sm:ps-9"
              />
            </div>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">{t("filters.allStatuses")}</option>
              <option value="OFFEN">{t("statuses.OFFEN")}</option>
              <option value="IN_BEARBEITUNG">
                {t("statuses.IN_BEARBEITUNG")}
              </option>
              <option value="GESCHLOSSEN">{t("statuses.GESCHLOSSEN")}</option>
            </Select>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">{t("filters.allCategories")}</option>
              <option value="SCHICHTPLAN">{t("categories.SCHICHTPLAN")}</option>
              <option value="ZEITERFASSUNG">
                {t("categories.ZEITERFASSUNG")}
              </option>
              <option value="LOHNABRECHNUNG">
                {t("categories.LOHNABRECHNUNG")}
              </option>
              <option value="TECHNIK">{t("categories.TECHNIK")}</option>
              <option value="HR">{t("categories.HR")}</option>
              <option value="QUALITAETSMANGEL">
                {t("categories.QUALITAETSMANGEL")}
              </option>
              <option value="FEHLENDE_LEISTUNG">
                {t("categories.FEHLENDE_LEISTUNG")}
              </option>
              <option value="SONSTIGES">{t("categories.SONSTIGES")}</option>
            </Select>
            <Button
              variant={filterAssignedToMe ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterAssignedToMe((v) => !v)}
              className="whitespace-nowrap"
            >
              {t("filters.assignedToMe")}
            </Button>
          </div>
          <Button onClick={() => router.push("/tickets/neu")}>
            <PlusIcon className="h-4 w-4" />
            {t("createTicket")}
          </Button>
        </div>

        {/* ── Ticket List ────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<TicketIcon className="h-8 w-8 text-emerald-500" />}
            title={t("emptyState.title")}
            description={
              canManage
                ? t("emptyState.managerDescription")
                : t("emptyState.description")
            }
            actions={
              canManage
                ? []
                : [
                    {
                      label: t("createTicket"),
                      onClick: () => router.push("/tickets/neu"),
                    },
                  ]
            }
          />
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-emerald-200 active:scale-[0.995]"
                onClick={() => router.push(`/tickets/${ticket.id}`)}
              >
                <CardContent className="p-4 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">
                          {ticket.ticketNumber}
                        </span>
                        <Badge
                          variant={STATUS_VARIANTS[ticket.status] ?? "outline"}
                        >
                          {t(`statuses.${ticket.status}`)}
                        </Badge>
                        <Badge
                          variant={
                            PRIORITY_VARIANTS[ticket.priority] ?? "outline"
                          }
                        >
                          {t(`priorities.${ticket.priority}`)}
                        </Badge>
                        {ticket.ticketType === "EXTERN" && (
                          <Badge variant="outline">
                            {t("ticketTypes.EXTERN")}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 truncate">
                        {ticket.subject}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span>{t(`categories.${ticket.category}`)}</span>
                        <span>·</span>
                        <span>
                          {ticket.ticketType === "EXTERN"
                            ? (ticket.externalSubmitterName ??
                              t("externalSubmitter"))
                            : (ticket.createdBy?.name ??
                              ticket.createdBy?.email ??
                              "–")}
                        </span>
                        <span>·</span>
                        <span>
                          {format(new Date(ticket.createdAt), "dd.MM.yyyy", {
                            locale: de,
                          })}
                        </span>
                        {ticket._count.comments > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              {ticket._count.comments}{" "}
                              {ticket._count.comments === 1
                                ? t("comment")
                                : t("comments")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {canManage && ticket.assignedTo && (
                      <div className="text-right text-xs text-gray-400 flex-shrink-0">
                        <div>{t("assignedTo")}</div>
                        <div className="font-medium text-gray-600">
                          {ticket.assignedTo.name ?? ticket.assignedTo.email}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const styles: Record<string, { card: string; badge: string }> = {
    emerald: {
      card: "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40",
      badge: "bg-emerald-600 dark:bg-emerald-500 text-white",
    },
    amber: {
      card: "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40",
      badge: "bg-amber-500 dark:bg-amber-500 text-white",
    },
    blue: {
      card: "border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40",
      badge: "bg-blue-500 dark:bg-blue-500 text-white",
    },
    gray: {
      card: "border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 dark:bg-zinc-800/60",
      badge: "bg-gray-50 dark:bg-zinc-800/500 dark:bg-zinc-500 text-white",
    },
  };

  const s = styles[color] ?? styles.gray;

  return (
    <div
      className={`rounded-2xl border p-3 text-center transition-shadow ${s.card}`}
    >
      <div
        className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${s.badge}`}
      >
        {value}
      </div>
      <p className="mt-1.5 text-xs font-medium text-gray-600 dark:text-zinc-400">
        {label}
      </p>
    </div>
  );
}
