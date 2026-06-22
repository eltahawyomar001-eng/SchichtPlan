"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DownloadIcon } from "@/components/icons";

interface Line {
  employeeId: string;
  name: string;
  hourlyRateCents: number;
  workedMinutes: number;
  baseCents: number;
  surchargeCents: number;
  surchargeByType: { NIGHT: number; SUNDAY: number; HOLIDAY: number };
  absencePaidDays: number;
  continuedPayCents: number;
  grossCents: number;
}
interface Result {
  year: number;
  month: number;
  lines: Line[];
  totals: {
    baseCents: number;
    surchargeCents: number;
    continuedPayCents: number;
    grossCents: number;
    employees: number;
  };
  draftCount: number;
  generatedAt: string;
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}
function hours(min: number): string {
  return (min / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

export default function LohnabrechnungPage() {
  const t = useTranslations("payroll");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // current month
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/run?year=${year}&month=${month}`);
      if (res.ok) setResult(await res.json());
      else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.message || d.error || "Fehler");
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadCsv() {
    if (!result) return;
    const head = [
      t("employee"),
      t("hourlyRate"),
      t("workedHours"),
      t("base"),
      t("surcharges"),
      t("continuedPay"),
      t("gross"),
    ].join(";");
    const rows = result.lines.map((l) =>
      [
        l.name,
        (l.hourlyRateCents / 100).toFixed(2),
        (l.workedMinutes / 60).toFixed(2),
        (l.baseCents / 100).toFixed(2),
        (l.surchargeCents / 100).toFixed(2),
        (l.continuedPayCents / 100).toFixed(2),
        (l.grossCents / 100).toFixed(2),
      ].join(";"),
    );
    const csv = [head, ...rows].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lohnabrechnung-${result.year}-${String(result.month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = [
    now.getFullYear(),
    now.getFullYear() - 1,
    now.getFullYear() - 2,
  ];

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={downloadCsv}
            disabled={!result}
          >
            <DownloadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        }
      />

      <PageContent className="max-w-5xl">
        <Card className="print:hidden">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>{t("month")}</Label>
              <Select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-40"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {t(`months.${m}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("year")}</Label>
              <Select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-28"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={run} disabled={loading}>
              {loading ? t("computing") : t("compute")}
            </Button>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
          {t("estimateNote")}
        </div>

        {loading && !result ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : result ? (
          <>
            {/* Draft-entries warning — drafts in this period are NOT in payroll
                until employees submit / a manager approves them. */}
            {result.draftCount > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                <span aria-hidden>⚠️</span>
                <span>{t("draftHint", { count: result.draftCount })}</span>
              </div>
            )}

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-4">
              <SummaryCard
                label={t("base")}
                value={euro(result.totals.baseCents)}
              />
              <SummaryCard
                label={t("surcharges")}
                value={euro(result.totals.surchargeCents)}
              />
              <SummaryCard
                label={t("continuedPay")}
                value={euro(result.totals.continuedPayCents)}
              />
              <SummaryCard
                label={t("totalGross")}
                value={euro(result.totals.grossCents)}
                strong
              />
            </div>

            <Card>
              <CardContent className="p-0">
                {result.lines.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">
                    {t("noData")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-gray-500 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">
                            {t("employee")}
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            {t("hourlyRate")}
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            {t("workedHours")}
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            {t("base")}
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            {t("surcharges")}
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            {t("continuedPay")}
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            {t("gross")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-zinc-800">
                        {result.lines.map((l) => (
                          <tr key={l.employeeId}>
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-zinc-100">
                              {l.name}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600 dark:text-zinc-300">
                              {euro(l.hourlyRateCents)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600 dark:text-zinc-300">
                              {hours(l.workedMinutes)} h
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {euro(l.baseCents)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {l.surchargeCents > 0
                                ? euro(l.surchargeCents)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {l.continuedPayCents > 0
                                ? euro(l.continuedPayCents)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-zinc-100">
                              {euro(l.grossCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </PageContent>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${
            strong ? "text-emerald-600" : "text-gray-900 dark:text-zinc-100"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
