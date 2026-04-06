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
import { TicketIcon, PlusIcon, SearchIcon } from "@/components/icons";
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
  "default" | "success" | "destructive" | "warning" | "outline"
> = {
  OFFEN: "warning",
  IN_BEARBEITUNG: "default",
  GESCHLOSSEN: "outline",
};

const PRIORITY_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "outline"
> = {
  NIEDRIG: "outline",
  MITTEL: "default",
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterAssignedToMe && user?.id) params.set("assignedToId", user.id);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data ?? data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCategory, filterAssignedToMe, user?.id, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [fetchTickets, fetchStats]);

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
              color="gray"
            />
            <StatCard
              label={t("stats.open")}
              value={stats.byStatus.OFFEN ?? 0}
              color="amber"
            />
            <StatCard
              label={t("stats.inProgress")}
              value={stats.byStatus.IN_BEARBEITUNG ?? 0}
              color="emerald"
            />
            <StatCard
              label={t("stats.closed")}
              value={stats.byStatus.GESCHLOSSEN ?? 0}
              color="green"
            />
          </div>
        )}

        {/* ── Toolbar ────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 sm:left-3 sm:h-4 sm:w-4" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-11 sm:ps-10"
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
          {!canManage && (
            <Button onClick={() => router.push("/tickets/neu")}>
              <PlusIcon className="h-4 w-4" />
              {t("createTicket")}
            </Button>
          )}
        </div>

        {/* ── Ticket List ────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-gray-100"
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
  const colorMap: Record<string, string> = {
    gray: "bg-gray-50 text-gray-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
  };

  return (
    <Card>
      <CardContent className="p-3 sm:p-3 text-center">
        <div
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${colorMap[color] ?? colorMap.gray}`}
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}
