"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";

interface ReportData {
  period: { start: string; end: string };
  summary: {
    totalShifts: number;
    totalShiftHours: number;
    openShifts: number;
    nightShifts: number;
    holidayShifts: number;
    sundayShifts: number;
    totalEmployees: number;
    avgHoursPerEmployee: number;
  };
  absences: {
    pending: number;
    approved: number;
    rejected: number;
  };
  employeeStats: {
    employeeId: string;
    name: string;
    hours: number;
    shifts: number;
  }[];
}

export default function BerichteSeite() {
  const t = useTranslations("reports");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Default: current month
  const now = new Date();
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [endDate, setEndDate] = useState(
    `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?start=${startDate}&end=${endDate}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">{t("from")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <label className="text-sm text-gray-600">{t("to")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label={t("totalShifts")}
                value={String(data.summary.totalShifts)}
              />
              <StatCard
                label={t("totalHours")}
                value={`${data.summary.totalShiftHours}h`}
              />
              <StatCard
                label={t("openShifts")}
                value={String(data.summary.openShifts)}
                accent={data.summary.openShifts > 0 ? "amber" : undefined}
              />
              <StatCard
                label={t("avgHoursPerEmployee")}
                value={`${data.summary.avgHoursPerEmployee}h`}
              />
            </div>

            {/* Surcharge shifts */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label={t("nightShifts")}
                value={String(data.summary.nightShifts)}
                accent="blue"
              />
              <StatCard
                label={t("sundayShifts")}
                value={String(data.summary.sundayShifts)}
                accent="violet"
              />
              <StatCard
                label={t("holidayShifts")}
                value={String(data.summary.holidayShifts)}
                accent="red"
              />
            </div>

            {/* Absence stats */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t("absences")}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {data.absences.pending}
                  </p>
                  <p className="text-xs text-gray-500">{t("pending")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {data.absences.approved}
                  </p>
                  <p className="text-xs text-gray-500">{t("approved")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {data.absences.rejected}
                  </p>
                  <p className="text-xs text-gray-500">{t("rejected")}</p>
                </div>
              </div>
            </div>

            {/* Employee hours ranking */}
            {data.employeeStats.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("employeeHours")}
                  </h2>
                </div>
                <ul className="divide-y divide-gray-100">
                  {data.employeeStats.map((emp, idx) => (
                    <li
                      key={emp.employeeId}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {emp.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {emp.hours}h
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({emp.shifts} {t("shifts")})
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("noData")}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "amber" | "blue" | "violet" | "red";
}) {
  const accentColors = {
    amber: "text-amber-600",
    blue: "text-blue-600",
    violet: "text-violet-600",
    red: "text-red-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ? accentColors[accent] : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}
