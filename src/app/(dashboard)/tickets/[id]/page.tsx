"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContent } from "@/components/ui/page-content";
import {
  ArrowLeftIcon,
  SendIcon,
  UserIcon,
  ClockIcon,
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

interface Comment {
  id: string;
  content: string;
  isInternal: boolean;
  author: TicketUser;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdBy: TicketUser;
  assignedTo: TicketUser | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

interface WorkspaceUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "outline"
> = {
  OFFEN: "warning",
  IN_BEARBEITUNG: "default",
  WARTEND: "outline",
  GELOEST: "success",
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

export default function TicketDetailPage() {
  const t = useTranslations("tickets");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const canManage = user ? isManagement(user) : false;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok) {
        setTicket(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchUsers = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data ?? data);
      }
    } catch {
      // silent
    }
  }, [canManage]);

  useEffect(() => {
    fetchTicket();
    fetchUsers();
  }, [fetchTicket, fetchUsers]);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: commentText,
          isInternal: canManage ? isInternal : false,
        }),
      });
      if (res.ok) {
        setCommentText("");
        setIsInternal(false);
        fetchTicket();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTicket = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchTicket();
      }
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title={t("title")} />
        <PageContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        </PageContent>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <Topbar title={t("title")} />
        <PageContent>
          <div className="text-center py-12">
            <p className="text-gray-500">{t("notFound")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/tickets")}
            >
              {t("backToList")}
            </Button>
          </div>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <Topbar title={ticket.ticketNumber} />
      <PageContent className="max-w-4xl">
        {/* ── Back + Header ────────────────────────────── */}
        <button
          onClick={() => router.push("/tickets")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToList")}
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {ticket.subject}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANTS[ticket.status] ?? "outline"}>
                {t(`statuses.${ticket.status}`)}
              </Badge>
              <Badge variant={PRIORITY_VARIANTS[ticket.priority] ?? "outline"}>
                {t(`priorities.${ticket.priority}`)}
              </Badge>
              <Badge variant="outline">
                {t(`categories.${ticket.category}`)}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Main Content Grid ──────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Description + Comments */}
          <div className="lg:col-span-2 space-y-4">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("description")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {t("commentsTitle")} ({ticket.comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.comments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {t("noComments")}
                  </p>
                )}
                {ticket.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-lg p-3 ${
                      comment.isInternal
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
                        {(comment.author.name ?? comment.author.email)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {comment.author.name ?? comment.author.email}
                      </span>
                      {comment.isInternal && (
                        <Badge variant="warning">{t("internalNote")}</Badge>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {format(
                          new Date(comment.createdAt),
                          "dd.MM.yyyy HH:mm",
                          { locale: de },
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap ml-8">
                      {comment.content}
                    </p>
                  </div>
                ))}

                {/* Add Comment */}
                <div className="border-t pt-4 mt-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t("commentPlaceholder")}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300 focus:outline-none resize-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {canManage && (
                        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          {t("internalNote")}
                        </label>
                      )}
                    </div>
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || submitting}
                      size="sm"
                    >
                      <SendIcon className="mr-1.5 h-3.5 w-3.5" />
                      {t("sendComment")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Sidebar Details */}
          <div className="space-y-4">
            {/* Meta info */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <DetailRow
                  label={t("createdBy")}
                  value={ticket.createdBy.name ?? ticket.createdBy.email}
                />
                <DetailRow
                  label={t("createdAt")}
                  value={format(
                    new Date(ticket.createdAt),
                    "dd.MM.yyyy HH:mm",
                    { locale: de },
                  )}
                />
                {ticket.assignedTo && (
                  <DetailRow
                    label={t("assignedTo")}
                    value={ticket.assignedTo.name ?? ticket.assignedTo.email}
                  />
                )}
                {ticket.resolvedAt && (
                  <DetailRow
                    label={t("resolvedAt")}
                    value={format(
                      new Date(ticket.resolvedAt),
                      "dd.MM.yyyy HH:mm",
                      { locale: de },
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Management Controls */}
            {canManage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t("manage")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">{t("status")}</Label>
                    <Select
                      value={ticket.status}
                      onChange={(e) =>
                        handleUpdateTicket({ status: e.target.value })
                      }
                    >
                      <option value="OFFEN">{t("statuses.OFFEN")}</option>
                      <option value="IN_BEARBEITUNG">
                        {t("statuses.IN_BEARBEITUNG")}
                      </option>
                      <option value="WARTEND">{t("statuses.WARTEND")}</option>
                      <option value="GELOEST">{t("statuses.GELOEST")}</option>
                      <option value="GESCHLOSSEN">
                        {t("statuses.GESCHLOSSEN")}
                      </option>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("priority")}</Label>
                    <Select
                      value={ticket.priority}
                      onChange={(e) =>
                        handleUpdateTicket({ priority: e.target.value })
                      }
                    >
                      <option value="NIEDRIG">{t("priorities.NIEDRIG")}</option>
                      <option value="MITTEL">{t("priorities.MITTEL")}</option>
                      <option value="HOCH">{t("priorities.HOCH")}</option>
                      <option value="DRINGEND">
                        {t("priorities.DRINGEND")}
                      </option>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("assignedTo")}</Label>
                    <Select
                      value={ticket.assignedTo?.id ?? ""}
                      onChange={(e) =>
                        handleUpdateTicket({
                          assignedToId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">{t("unassigned")}</option>
                      {users
                        .filter((u) =>
                          ["OWNER", "ADMIN", "MANAGER"].includes(u.role),
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </option>
                        ))}
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}

// ─── Detail Row ─────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
