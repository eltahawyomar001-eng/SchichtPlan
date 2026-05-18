"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContent } from "@/components/ui/page-content";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftIcon, TrashIcon, RefreshIcon } from "@/components/icons";

interface TrashTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function TicketTrashPage() {
  const t = useTranslations("tickets");
  const tt = useTranslations("ticketTrash");
  const locale = useLocale();
  const dateLocale = locale === "de" ? de : enUS;
  const router = useRouter();

  const [items, setItems] = useState<TrashTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tickets?trash=true&take=200", {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.data ?? data);
        setError(null);
      } else {
        setError(data.message ?? data.error ?? tt("loadError"));
      }
    } catch {
      setError(tt("networkError"));
    } finally {
      setLoading(false);
    }
  }, [tt]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/tickets/${id}/restore`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? data.error ?? tt("restoreError"));
      }
      await fetchTrash();
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(id: string) {
    if (!confirm(tt("confirmPurge"))) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/tickets/${id}?purge=true`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? data.error ?? tt("purgeError"));
      }
      await fetchTrash();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Topbar title={tt("title")} />
      <PageContent>
        <button
          onClick={() => router.push("/tickets")}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToList")}
        </button>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {tt("storageHint")}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {tt("loading")}
          </p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={<TrashIcon className="h-12 w-12" />}
                title={tt("emptyTitle")}
                description={tt("emptyDescription")}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-gray-500 dark:text-zinc-400">
                        {t.ticketNumber}
                      </span>
                      <Badge variant="outline">{t.status}</Badge>
                      <Badge variant="outline">{t.priority}</Badge>
                    </div>
                    <Link
                      href={`/tickets/${t.id}`}
                      className="mt-1 block truncate text-sm font-semibold text-gray-900 dark:text-zinc-100 hover:underline"
                    >
                      {t.subject}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                      {tt("deletedAt", {
                        date: format(
                          new Date(t.updatedAt),
                          "dd.MM.yyyy HH:mm",
                          {
                            locale: dateLocale,
                          },
                        ),
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestore(t.id)}
                      disabled={busyId === t.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 disabled:opacity-50"
                    >
                      <RefreshIcon className="h-4 w-4" />
                      {tt("restore")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge(t.id)}
                      disabled={busyId === t.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      {tt("purgeForever")}
                    </button>
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
