"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import { DownloadIcon } from "@/components/icons";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";

export default function DatenSeite() {
  const t = useTranslations("dataIO");
  const { handlePlanLimit } = usePlanLimit();
  const [importType, setImportType] = useState("employees");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exportType, setExportType] = useState("shifts");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportingFile, setExportingFile] = useState(false);
  const [exportMsg, setExportMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // iCal
  const [icalCopied, setIcalCopied] = useState(false);
  const icalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/ical`
      : "/api/ical";

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg({
          type: "success",
          text: `${data.imported} ${t("recordsImported")}`,
        });
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setImportMsg({
          type: "error",
          text: data.error || t("importError"),
        });
      }
    } catch {
      setImportMsg({ type: "error", text: t("networkError") });
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExportingFile(true);
    setExportMsg(null);
    try {
      const params = new URLSearchParams({
        type: exportType,
        format: exportFormat,
      });
      if (exportStart) params.set("start", exportStart);
      if (exportEnd) params.set("end", exportEnd);

      const res = await fetch(`/api/export/download?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext =
          exportFormat === "csv"
            ? "csv"
            : exportFormat === "pdf"
              ? "pdf"
              : "xlsx";
        a.download = `shiftfy-${exportType}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) {
          const data = await res.json().catch(() => ({}));
          setExportMsg({
            type: "error",
            text: data.error || t("exportError"),
          });
        }
      }
    } catch {
      setExportMsg({ type: "error", text: t("networkError") });
    } finally {
      setExportingFile(false);
    }
  }

  function copyIcal() {
    navigator.clipboard.writeText(icalUrl);
    setIcalCopied(true);
    setTimeout(() => setIcalCopied(false), 2000);
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent className="max-w-3xl">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("importTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  {t("importType")}
                </label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 dark:text-zinc-100"
                >
                  <option value="employees">{t("employees")}</option>
                  <option value="shifts">{t("shifts")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  {t("file")}
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="text-sm"
                />
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? "..." : t("importBtn")}
              </button>
            </div>
            {importMsg && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  importMsg.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {importMsg.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("exportTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  {t("exportType")}
                </label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 dark:text-zinc-100"
                >
                  <option value="shifts">{t("shifts")}</option>
                  <option value="time-entries">{t("timeEntries")}</option>
                  <option value="employees">{t("employees")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  {t("format")}
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 dark:text-zinc-100"
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="pdf">PDF (.pdf)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  {t("from")}
                </label>
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  {t("to")}
                </label>
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 dark:text-zinc-100"
                />
              </div>
              <button
                onClick={handleExport}
                disabled={exportingFile}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <DownloadIcon className="h-4 w-4" />
                {exportingFile ? "..." : t("exportBtn")}
              </button>
            </div>
            {exportMsg && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  exportMsg.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {exportMsg.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* iCal Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("icalTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400">
              {t("icalDesc")}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                readOnly
                value={icalUrl}
                className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700 dark:text-zinc-300 truncate"
              />
              <button
                onClick={copyIcal}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50"
              >
                {icalCopied ? "✓" : t("copy")}
              </button>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </div>
  );
}
