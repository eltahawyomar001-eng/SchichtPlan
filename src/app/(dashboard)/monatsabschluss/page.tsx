"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageContent } from "@/components/ui/page-content";
import { ESignatureBadge } from "@/components/e-signature-badge";

interface MonthCloseRecord {
  id: string;
  year: number;
  month: number;
  status: "OPEN" | "LOCKED" | "EXPORTED";
  lockedBy?: string | null;
  lockedAt?: string | null;
  exportedAt?: string | null;
}

export default function MonatsabschlussSeite() {
  const t = useTranslations("monthClose");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [records, setRecords] = useState<MonthCloseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    month: number;
    action: "lock" | "unlock" | "export";
  } | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const fetchRecords = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/month-close?year=${year}`);
      if (res.ok) setRecords(await res.json());
      else setError(tc("errorLoading"));
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleAction(
    monthNum: number,
    action: "lock" | "unlock" | "export",
  ) {
    // Both closing and reopening require confirmation
    if (action === "lock" || action === "unlock") {
      setConfirmAction({ month: monthNum, action });
      return;
    }
    await executeAction(monthNum, action);
  }

  async function executeAction(
    monthNum: number,
    action: "lock" | "unlock" | "export",
  ) {
    const key = `${monthNum}-${action}`;
    setActing(key);
    try {
      const res = await fetch("/api/month-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month: monthNum, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || tc("errorOccurred"));
      }
      fetchRecords();
    } catch {
      setError(tc("errorOccurred"));
    } finally {
      setActing(null);
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthKeys = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ] as const;

  const statusConfig: Record<string, { color: string; label: string }> = {
    OPEN: {
      color: "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300",
      label: t("open"),
    },
    LOCKED: { color: "bg-emerald-100 text-emerald-800", label: t("locked") },
    EXPORTED: {
      color: "bg-emerald-100 text-emerald-800",
      label: t("exported"),
    },
  };

  const currentYear = now.getFullYear();

  return (
    <>
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <PageContent>
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <Label>{t("year")}:</Label>
            <Select
              value={String(year)}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-28"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {months.map((m) => {
                const record = records.find((r) => r.month === m);
                const status = record?.status || "OPEN";
                const sc = statusConfig[status];

                return (
                  <Card key={m} className="card-elevated">
                    <CardContent className="p-5 sm:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">
                          {t(monthKeys[m - 1])}
                        </h3>
                        <Badge className={sc.color}>{sc.label}</Badge>
                      </div>

                      {/* E-Signature for locked/exported months */}
                      {record &&
                        (status === "LOCKED" || status === "EXPORTED") && (
                          <ESignatureBadge
                            entityType="MonthClose"
                            entityId={record.id}
                            compact
                          />
                        )}

                      <div className="flex gap-2 mt-2">
                        {status === "OPEN" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleAction(m, "lock")}
                            disabled={acting === `${m}-lock`}
                          >
                            {t("lock")}
                          </Button>
                        )}
                        {(status === "LOCKED" || status === "EXPORTED") && (
                          <div className="flex flex-col gap-2 w-full">
                            {record?.lockedAt && (
                              <p className="text-xs text-gray-400 dark:text-zinc-500">
                                {t("closedAt")}:{" "}
                                {new Date(record.lockedAt).toLocaleDateString(
                                  locale === "en" ? "en-GB" : "de-DE",
                                )}
                              </p>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleAction(m, "unlock")}
                              disabled={acting === `${m}-unlock`}
                            >
                              {t("reopen")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </PageContent>
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.action === "lock"
            ? t("lockConfirmTitle")
            : t("reopenConfirmTitle")
        }
        message={
          confirmAction?.action === "lock"
            ? t("lockConfirmMessage")
            : t("reopenConfirmMessage")
        }
        confirmLabel={
          confirmAction?.action === "lock" ? t("lock") : t("reopen")
        }
        cancelLabel={tc("cancel")}
        variant={confirmAction?.action === "unlock" ? "warning" : "danger"}
        onConfirm={async () => {
          if (confirmAction) {
            const { month, action } = confirmAction;
            setConfirmAction(null);
            await executeAction(month, action);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
