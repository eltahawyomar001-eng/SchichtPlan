"use client";

/**
 * The e-invoice inbox.
 *
 * Receiving has been mandatory for every German business since 1 January 2025,
 * which is earlier than the obligation to send -- so for most customers this
 * is the half of the law that already applies.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import {
  DownloadIcon,
  CheckCircleIcon,
  CircleXIcon,
  UploadCloudIcon,
  FileCheckIcon,
} from "@/components/icons";

interface Incoming {
  id: string;
  fileName: string | null;
  syntax: "CII" | "UBL";
  number: string | null;
  typeCode: string | null;
  issueDate: string | null;
  dueDate: string | null;
  sellerName: string | null;
  sellerVatId: string | null;
  grossCents: number | null;
  status: "NEU" | "GEPRUEFT" | "BEZAHLT" | "ABGELEHNT";
  createdAt: string;
}

interface Summary {
  total: number;
  openCount: number;
  openCents: number;
}

const BADGE: Record<Incoming["status"], string> = {
  NEU: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  GEPRUEFT:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  BEZAHLT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ABGELEHNT: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function euro(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function deDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("de-DE") : "—";
}

export default function ERechnungEingangPage() {
  const t = useTranslations("eInvoiceInbox");
  const tc = useTranslations("common");

  const [rows, setRows] = useState<Incoming[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState("ALLE");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/e-rechnung/eingang?status=${encodeURIComponent(status)}`,
      );
      if (res.ok) {
        const d = await res.json();
        setRows(d.invoices ?? []);
        setSummary(d.summary ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function importFile(file: File) {
    setImporting(true);
    try {
      const xml = await file.text();
      const res = await fetch("/api/e-rechnung/eingang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml, fileName: file.name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The parser's own message names what is wrong with the file, which
        // is what the user has to take back to the supplier.
        toast.error(d.message ?? t("importFailed"));
        return;
      }
      toast.success(
        t("imported", {
          number: d.number ?? "—",
          seller: d.sellerName ?? "—",
        }),
      );
      if (Array.isArray(d.missing) && d.missing.length > 0) {
        // A warning, not an error: the invoice is the sender's document and
        // we do not get to reject it on a technicality.
        toast.error(t("missingFields", { fields: d.missing.join(", ") }));
      }
      void load();
    } catch {
      toast.error(t("importFailed"));
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function setRowStatus(id: string, next: Incoming["status"]) {
    const res = await fetch(`/api/e-rechnung/eingang/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) void load();
    else toast.error(tc("errorOccurred"));
  }

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            size="sm"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            <UploadCloudIcon className="h-4 w-4" />
            <span className="hidden sm:inline">
              {importing ? t("importing") : t("import")}
            </span>
          </Button>
        }
      />
      <PageContent>
        <input
          ref={fileInput}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />

        {/* Drop zone. Importing is the primary action on this page, and a
            forwarded supplier mail is usually dragged straight out of it. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void importFile(f);
          }}
          className={`rounded-3xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-gray-200 dark:border-zinc-800"
          }`}
        >
          <FileCheckIcon className="mx-auto h-8 w-8 text-gray-400 dark:text-zinc-500" />
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">
            {t("importHint")}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {t("legalNote")}
          </p>
        </div>

        {summary && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {t("openCount")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                  {summary.openCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {t("openAmount")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                  {euro(summary.openCents)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {t("totalCount")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                  {summary.total}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-48"
          >
            <option value="ALLE">{t("all")}</option>
            <option value="NEU">{t("statusNEU")}</option>
            <option value="GEPRUEFT">{t("statusGEPRUEFT")}</option>
            <option value="BEZAHLT">{t("statusBEZAHLT")}</option>
            <option value="ABGELEHNT">{t("statusABGELEHNT")}</option>
          </Select>
        </div>

        <Card className="mt-3">
          <CardContent className="p-0">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {tc("loading")}
              </p>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {t("empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-gray-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">
                        {t("supplier")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">{t("number")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("date")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("due")}</th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t("amount")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("statusLabel")}
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-900 dark:text-zinc-100">
                            {r.sellerName ?? "—"}
                          </span>
                          {/* Which syntax it arrived in. Worth showing: it is
                              the first thing to check when a supplier's file
                              behaves oddly. */}
                          <span className="ml-2 text-[10px] uppercase text-gray-400 dark:text-zinc-500">
                            {r.syntax}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                          {r.number ?? "—"}
                          {r.typeCode === "381" && (
                            <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                              {t("creditNote")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                          {deDate(r.issueDate)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                          {deDate(r.dueDate)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {euro(r.grossCents)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={`${BADGE[r.status]} text-xs`}>
                            {t(`status${r.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              title={t("downloadOriginal")}
                              onClick={() =>
                                window.open(
                                  `/api/e-rechnung/eingang/${r.id}/xml`,
                                  "_blank",
                                )
                              }
                            >
                              <DownloadIcon className="h-3.5 w-3.5" />
                            </Button>
                            {r.status === "NEU" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRowStatus(r.id, "GEPRUEFT")}
                                >
                                  {t("markChecked")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title={t("reject")}
                                  onClick={() =>
                                    setRowStatus(r.id, "ABGELEHNT")
                                  }
                                >
                                  <CircleXIcon className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </>
                            )}
                            {r.status === "GEPRUEFT" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRowStatus(r.id, "BEZAHLT")}
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                {t("markPaid")}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </div>
  );
}
