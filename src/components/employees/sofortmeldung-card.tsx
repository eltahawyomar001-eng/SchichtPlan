"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircleIcon } from "@/components/icons";

interface Submission {
  id: string;
  status: string;
  trackingId: string | null;
  sandbox: boolean;
  errorMessage: string | null;
  submittedAt: string;
  meldegrund: string | null;
}

function statusVariant(
  status: string,
): "success" | "warning" | "outline" | "destructive" {
  if (status === "ACCEPTED") return "success";
  if (status === "PENDING" || status === "SENT") return "warning";
  if (status === "ERROR" || status === "REJECTED") return "destructive";
  return "outline";
}

interface Props {
  employeeId: string;
}

export function SofortmeldungCard({ employeeId }: Props) {
  const t = useTranslations("sofortmeldung");
  const locale = useLocale();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/sofortmeldung");
      if (!res.ok) return;
      const all: (Submission & { employeeId: string })[] = await res.json();
      setSubmissions(all.filter((s) => s.employeeId === employeeId));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function trigger() {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/compliance/sofortmeldung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          kind: "error",
          text: data.error ?? data.message ?? t("genericError"),
        });
      } else {
        setFeedback({ kind: "success", text: t("submitted") });
        await load();
      }
    } catch {
      setFeedback({ kind: "error", text: t("networkError") });
    } finally {
      setSubmitting(false);
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircleIcon className="h-5 w-5 text-emerald-600" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          {t("description")}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={trigger} disabled={submitting}>
            {submitting ? t("submitting") : t("triggerButton")}
          </Button>
          {feedback && (
            <span
              className={
                feedback.kind === "success"
                  ? "text-sm text-emerald-600"
                  : "text-sm text-red-600"
              }
            >
              {feedback.text}
            </span>
          )}
        </div>

        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        ) : submissions.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            {t("noSubmissions")}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-gray-400 dark:text-zinc-500">
              {t("historyTitle")}
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {submissions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(s.status)}>
                        {s.status}
                      </Badge>
                      {s.sandbox && (
                        <Badge variant="outline">{t("sandbox")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {fmtDate(s.submittedAt)}
                      {s.trackingId ? ` · ${s.trackingId}` : ""}
                    </p>
                    {s.errorMessage && (
                      <p className="text-xs text-red-600">{s.errorMessage}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
