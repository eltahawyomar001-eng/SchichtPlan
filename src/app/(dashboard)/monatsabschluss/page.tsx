"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";

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
  const [records, setRecords] = useState<MonthCloseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/month-close?year=${year}`);
      if (res.ok) setRecords(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleAction(
    monthNum: number,
    action: "lock" | "unlock" | "export",
  ) {
    const key = `${monthNum}-${action}`;
    setActing(key);
    try {
      await fetch("/api/month-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month: monthNum, action }),
      });
      fetchRecords();
    } catch {
      // ignore
    } finally {
      setActing(null);
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthNames = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  const statusBadge: Record<string, string> = {
    OPEN: "bg-gray-100 text-gray-700",
    LOCKED: "bg-yellow-100 text-yellow-800",
    EXPORTED: "bg-green-100 text-green-800",
  };

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Year selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            {t("year")}:
          </label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((m) => {
              const record = records.find((r) => r.month === m);
              const status = record?.status || "OPEN";

              return (
                <div
                  key={m}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">
                      {monthNames[m - 1]}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[status]}`}
                    >
                      {t(
                        status.toLowerCase() as "open" | "locked" | "exported",
                      )}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {status === "OPEN" && (
                      <button
                        onClick={() => handleAction(m, "lock")}
                        disabled={acting === `${m}-lock`}
                        className="flex-1 rounded-lg bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
                      >
                        {t("lock")}
                      </button>
                    )}
                    {status === "LOCKED" && (
                      <>
                        <button
                          onClick={() => handleAction(m, "unlock")}
                          disabled={acting === `${m}-unlock`}
                          className="flex-1 rounded-lg bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {t("unlock")}
                        </button>
                        <button
                          onClick={() => handleAction(m, "export")}
                          disabled={acting === `${m}-export`}
                          className="flex-1 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
                        >
                          {t("export")}
                        </button>
                      </>
                    )}
                    {status === "EXPORTED" && (
                      <p className="text-xs text-gray-400">
                        {record?.exportedAt
                          ? new Date(record.exportedAt).toLocaleDateString(
                              "de-DE",
                            )
                          : "—"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
