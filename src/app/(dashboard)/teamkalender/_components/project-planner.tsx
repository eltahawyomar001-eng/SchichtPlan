"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";

interface ProjectPlannerEmployee {
  id: string;
  name: string;
  minutes: number;
}

interface ProjectPlannerDailyEntry {
  date: string;
  minutes: number;
}

interface ProjectPlannerRow {
  id: string;
  name: string;
  status: string;
  budgetMinutes: number | null;
  startDate: string | null;
  endDate: string | null;
  client: { id: string; name: string } | null;
  totalMinutes: number;
  utilisationPercent: number | null;
  employees: ProjectPlannerEmployee[];
  daily: ProjectPlannerDailyEntry[];
}

function minutesToHm(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function statusColor(status: string): string {
  switch (status) {
    case "AKTIV":
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
    case "PAUSIERT":
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300";
    case "ABGESCHLOSSEN":
      return "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300";
    case "ARCHIVIERT":
      return "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400";
    default:
      return "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400";
  }
}

interface Props {
  startDate: Date;
  endDate: Date;
}

export function ProjectPlanner({ startDate, endDate }: Props) {
  const t = useTranslations("teamkalender");
  const locale = useLocale();
  const dfnsLocale = locale === "en" ? enUS : de;

  const [projects, setProjects] = useState<ProjectPlannerRow[]>([]);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: true, error: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loading = state.loading;
  const error = state.error;

  useEffect(() => {
    let aborted = false;
    const start = format(startDate, "yyyy-MM-dd");
    const end = format(endDate, "yyyy-MM-dd");
    // Reset state in one call (no cascading renders inside the effect body)
    queueMicrotask(() => {
      if (!aborted) setState({ loading: true, error: null });
    });
    fetch(`/api/projects/planner?start=${start}&end=${end}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("loadError");
        return res.json();
      })
      .then((data) => {
        if (aborted) return;
        setProjects(data.projects ?? []);
        setState({ loading: false, error: null });
      })
      .catch(() => {
        if (!aborted) setState({ loading: false, error: "loadError" });
      });
    return () => {
      aborted = true;
    };
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500 dark:text-zinc-400">
        {t.has("loading") ? t("loading") : "Lade…"}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
        {t.has("errorLoading")
          ? t("errorLoading")
          : "Daten konnten nicht geladen werden."}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-sm font-medium text-gray-600 dark:text-zinc-300">
          {t.has("noProjects") ? t("noProjects") : "Keine Projekte vorhanden."}
        </p>
        <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-md mx-auto">
          {t.has("noProjectsHint")
            ? t("noProjectsHint")
            : 'Lege Projekte unter „Projekte" an und ordne Zeiteinträge zu, um eine projektbezogene Auswertung zu erhalten.'}
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(1, ...projects.map((p) => p.totalMinutes));

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 dark:text-zinc-400">
        {format(startDate, "PP", { locale: dfnsLocale })} –{" "}
        {format(endDate, "PP", { locale: dfnsLocale })}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700">
        {projects.map((p, idx) => {
          const expanded = expandedId === p.id;
          const barWidthPct = Math.round((p.totalMinutes / maxTotal) * 100);
          const overBudget =
            p.utilisationPercent !== null && p.utilisationPercent > 100;
          return (
            <div
              key={p.id}
              className={`${idx > 0 ? "border-t border-gray-200 dark:border-zinc-700" : ""}`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : p.id)}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 dark:text-zinc-100 truncate">
                        {p.name}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusColor(p.status)}`}
                      >
                        {p.status}
                      </span>
                      {p.client && (
                        <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                          · {p.client.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
                      <span>
                        {minutesToHm(p.totalMinutes)}
                        {p.budgetMinutes !== null && p.budgetMinutes > 0 && (
                          <> / {minutesToHm(p.budgetMinutes)}</>
                        )}
                      </span>
                      {p.utilisationPercent !== null && (
                        <span
                          className={
                            overBudget
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : ""
                          }
                        >
                          {p.utilisationPercent}%
                        </span>
                      )}
                      <span>
                        · {p.employees.length}{" "}
                        {t.has("members") ? t("members") : "Mitarbeiter"}
                      </span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="w-32 sm:w-48 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full ${
                        overBudget ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, barWidthPct)}%` }}
                    />
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 -mt-1">
                  {p.employees.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 italic">
                      {t.has("noEntries")
                        ? t("noEntries")
                        : "Keine Einträge im Zeitraum."}
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 dark:text-zinc-400">
                          <th className="text-left font-normal py-1">
                            {t.has("employee") ? t("employee") : "Mitarbeiter"}
                          </th>
                          <th className="text-right font-normal py-1">
                            {t.has("hours") ? t("hours") : "Stunden"}
                          </th>
                          <th className="text-right font-normal py-1">
                            {t.has("share") ? t("share") : "Anteil"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.employees.map((e) => {
                          const share =
                            p.totalMinutes > 0
                              ? Math.round((e.minutes / p.totalMinutes) * 100)
                              : 0;
                          return (
                            <tr
                              key={e.id}
                              className="border-t border-gray-100 dark:border-zinc-800"
                            >
                              <td className="py-1.5 text-gray-700 dark:text-zinc-300">
                                {e.name}
                              </td>
                              <td className="py-1.5 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                                {minutesToHm(e.minutes)}
                              </td>
                              <td className="py-1.5 text-right text-gray-500 dark:text-zinc-400 tabular-nums">
                                {share}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
