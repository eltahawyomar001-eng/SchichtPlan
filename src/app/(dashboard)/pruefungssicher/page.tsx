"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageContent } from "@/components/ui/page-content";
import {
  ShieldCheckIcon,
  ScaleIcon,
  ClockIcon,
  AwardIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  CircleXIcon,
  FileCheckIcon,
  DownloadIcon,
} from "@/components/icons";

type Severity = "WARN" | "FAIL";
type CategoryKey =
  | "ARBZG_3"
  | "ARBZG_4"
  | "ARBZG_5"
  | "SACHKUNDE_34A"
  | "MILOG";

interface Finding {
  category: CategoryKey;
  severity: Severity;
  code: string;
  employeeName?: string;
  date?: string;
  locationName?: string;
  values?: Record<string, string | number>;
}
interface CategorySummary {
  category: CategoryKey;
  items: number;
  pass: number;
  warn: number;
  fail: number;
}
interface ReadinessResult {
  periodStart: string;
  periodEnd: string;
  minHourlyWageCents: number;
  score: number;
  totals: { items: number; pass: number; warn: number; fail: number };
  categories: CategorySummary[];
  findings: Finding[];
  employeeSummaries: {
    employeeId: string;
    name: string;
    shiftCount: number;
    plannedMinutes: number;
    hourlyRate: number | null;
  }[];
  generatedAt: string;
}
interface DossierRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  readinessScore: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  contentHash: string;
  generatedAt: string;
}

const CATEGORY_ICON: Record<CategoryKey, typeof ShieldCheckIcon> = {
  ARBZG_3: ClockIcon,
  ARBZG_4: ClockIcon,
  ARBZG_5: ClockIcon,
  SACHKUNDE_34A: AwardIcon,
  MILOG: ScaleIcon,
};

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("de-DE");
}
function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

export default function PruefungssicherPage() {
  const t = useTranslations("pruefung");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "OWNER" || role === "ADMIN";

  const [from, setFrom] = useState(todayISO(-30));
  const [to, setTo] = useState(todayISO(0));
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [minWage, setMinWage] = useState("");
  const [savingWage, setSavingWage] = useState(false);
  const [archivedView, setArchivedView] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [justArchived, setJustArchived] = useState<string | null>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    setArchivedView(null);
    setApiError(null);
    try {
      const res = await fetch(
        `/api/compliance/readiness?from=${from}&to=${to}`,
      );
      if (res.ok) {
        setResult(await res.json());
      } else {
        const d = await res.json().catch(() => ({}));
        const msg = d?.message || d?.error || `Fehler ${res.status}`;
        setApiError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Netzwerkfehler";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const fetchDossiers = useCallback(async () => {
    const res = await fetch("/api/compliance/dossier");
    if (res.ok) setDossiers(await res.json());
  }, []);

  const fetchMinWage = useCallback(async () => {
    const res = await fetch("/api/compliance/min-wage");
    if (res.ok) {
      const d = await res.json();
      setMinWage((d.minHourlyWageCents / 100).toFixed(2));
    }
  }, []);

  useEffect(() => {
    fetchReadiness();
    fetchDossiers();
    fetchMinWage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveMinWage() {
    setSavingWage(true);
    try {
      const res = await fetch("/api/compliance/min-wage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyWage: Number(minWage) }),
      });
      if (res.ok) {
        toast.success(t("wageSaved"));
        fetchReadiness();
      } else {
        toast.error(tc("errorOccurred"));
      }
    } finally {
      setSavingWage(false);
    }
  }

  async function generateDossier() {
    setGenerating(true);
    setApiError(null);
    try {
      const res = await fetch("/api/compliance/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("dossierCreated"));
        await fetchDossiers();
        if (data?.id) setJustArchived(data.id);
        // Bring the freshly archived dossier into view so it's never "lost".
        setTimeout(() => {
          archiveRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
        setTimeout(() => setJustArchived(null), 6000);
      } else {
        const msg =
          data?.message || data?.error || `Server error ${res.status}`;
        setApiError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Netzwerkfehler";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function viewArchived(id: string) {
    const res = await fetch(`/api/compliance/dossier/${id}`);
    if (res.ok) {
      const d = await res.json();
      setResult(d.snapshot as ReadinessResult);
      setArchivedView(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function findingMessage(f: Finding): string {
    return t(`finding.${f.code}`, { ...(f.values ?? {}) });
  }

  const fails = result?.findings.filter((f) => f.severity === "FAIL") ?? [];
  const warns = result?.findings.filter((f) => f.severity === "WARN") ?? [];

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={!result}
            >
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("print")}</span>
            </Button>
            <Button size="sm" onClick={generateDossier} disabled={generating}>
              <FileCheckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {generating ? t("generating") : t("archive")}
              </span>
            </Button>
          </div>
        }
      />

      <PageContent className="max-w-5xl">
        {/* Intro */}
        <Card className="print:hidden">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3">
            <ShieldCheckIcon className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
              {t("intro")}
            </p>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="print:hidden">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>{t("from")}</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("to")}</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button onClick={fetchReadiness} disabled={loading}>
              {loading ? t("checking") : t("refresh")}
            </Button>
            {isAdmin && (
              <div className="ml-auto flex items-end gap-2">
                <div className="space-y-1.5">
                  <Label>{t("minWage")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="w-28"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={saveMinWage}
                  disabled={savingWage}
                >
                  {tc("save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {apiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2 print:hidden">
            <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Fehler beim Archivieren</p>
              <p className="mt-0.5 font-mono text-xs">{apiError}</p>
            </div>
          </div>
        )}

        {loading && !result ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : result ? (
          <>
            {archivedView && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 print:hidden">
                {t("viewingArchived", {
                  date: fmtDate(result.generatedAt),
                })}
              </div>
            )}

            {/* Print header (only on print) */}
            <div className="hidden print:block mb-4">
              <h1 className="text-xl font-bold">{t("dossierTitle")}</h1>
              <p className="text-sm">
                {t("period")}: {fmtDate(result.periodStart)} –{" "}
                {fmtDate(result.periodEnd)} · {t("generatedAt")}:{" "}
                {new Date(result.generatedAt).toLocaleString("de-DE")}
              </p>
            </div>

            {/* Score + summary */}
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <Card>
                <CardContent className="p-6 text-center">
                  <p
                    className={`text-5xl font-extrabold ${scoreColor(result.score)}`}
                  >
                    {result.score}
                    <span className="text-2xl">%</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    {t("readiness")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 sm:p-5 grid grid-cols-3 gap-3 items-center h-full">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {result.totals.pass}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {t("pass")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {result.totals.warn}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {t("warn")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {result.totals.fail}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {t("fail")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Categories */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {result.categories.map((c) => {
                const Icon = CATEGORY_ICON[c.category];
                const ok = c.fail === 0 && c.warn === 0;
                return (
                  <Card key={c.category}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          className={`h-4 w-4 ${c.fail > 0 ? "text-red-500" : c.warn > 0 ? "text-amber-500" : "text-emerald-600"}`}
                        />
                        <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                          {t(`category.${c.category}`)}
                        </span>
                      </div>
                      {ok ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                          <CheckCircleIcon className="h-3 w-3" />
                          {t("compliant")}
                        </Badge>
                      ) : (
                        <div className="flex gap-1.5 flex-wrap">
                          {c.fail > 0 && (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                              {c.fail} {t("fail")}
                            </Badge>
                          )}
                          {c.warn > 0 && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              {c.warn} {t("warn")}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Findings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("findings")}</CardTitle>
              </CardHeader>
              <CardContent>
                {fails.length === 0 && warns.length === 0 ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-sm text-emerald-700">
                    <CheckCircleIcon className="h-5 w-5" />
                    {t("allClear")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...fails, ...warns].map((f, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-gray-100 dark:border-zinc-800 p-3"
                      >
                        {f.severity === "FAIL" ? (
                          <CircleXIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangleIcon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 text-sm">
                          <p className="text-gray-900 dark:text-zinc-100">
                            {findingMessage(f)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">
                            <span className="font-medium">
                              {t(`category.${f.category}`)}
                            </span>
                            {f.employeeName ? ` · ${f.employeeName}` : ""}
                            {f.date ? ` · ${fmtDate(f.date)}` : ""}
                            {f.locationName ? ` · ${f.locationName}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Per-employee working-time summary (dossier) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("employeeSummary")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.employeeSummaries.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">
                    {t("noData")}
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500 dark:text-zinc-400">
                          <th className="px-6 pb-2 font-medium">
                            {t("employee")}
                          </th>
                          <th className="px-6 pb-2 font-medium">
                            {t("shifts")}
                          </th>
                          <th className="px-6 pb-2 font-medium">
                            {t("plannedHours")}
                          </th>
                          <th className="px-6 pb-2 font-medium">
                            {t("hourlyRate")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-zinc-800">
                        {result.employeeSummaries.map((e) => (
                          <tr key={e.employeeId}>
                            <td className="px-6 py-2">{e.name}</td>
                            <td className="px-6 py-2">{e.shiftCount}</td>
                            <td className="px-6 py-2">
                              {(e.plannedMinutes / 60).toFixed(1)} h
                            </td>
                            <td className="px-6 py-2">
                              {e.hourlyRate != null
                                ? `${e.hourlyRate.toFixed(2)} €`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-[11px] text-gray-400 print:mt-4">
              {t("hashNote")}
            </p>
          </>
        ) : null}

        {/* Archived dossiers — always visible so a freshly archived dossier is
            never "lost" at the bottom of a long report. */}
        <Card className="print:hidden" ref={archiveRef}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheckIcon className="h-5 w-5 text-emerald-600" />
              {t("archiveTitle")}
              {dossiers.length > 0 && (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                  {dossiers.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dossiers.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                {t("noArchive")}
              </p>
            ) : (
              <div className="space-y-2">
                {dossiers.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                      justArchived === d.id
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-gray-100 dark:border-zinc-800"
                    }`}
                  >
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-gray-900 dark:text-zinc-100">
                        {fmtDate(d.periodStart)} – {fmtDate(d.periodEnd)}
                      </span>
                      <span
                        className={`ml-2 font-semibold ${scoreColor(d.readinessScore)}`}
                      >
                        {d.readinessScore}%
                      </span>
                      {justArchived === d.id && (
                        <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                          {t("justArchived")}
                        </Badge>
                      )}
                      <span className="ml-2 text-xs text-gray-400 font-mono">
                        #{d.contentHash.slice(0, 10)}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {new Date(d.generatedAt).toLocaleString("de-DE")}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewArchived(d.id)}
                    >
                      {t("open")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </div>
  );
}
