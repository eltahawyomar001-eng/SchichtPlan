"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { BUNDESLAENDER } from "@/lib/holidays";

interface Holiday {
  name: string;
  date: string;
  isNational: boolean;
}

interface HolidayResponse {
  year: number;
  bundesland: string;
  bundeslandName: string;
  holidays: Holiday[];
}

export default function FeiertageSeite() {
  const t = useTranslations("holidays");
  const [data, setData] = useState<HolidayResponse | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [bundesland, setBundesland] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
      });
      if (bundesland) params.set("bundesland", bundesland);
      const res = await fetch(`/api/holidays?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (!bundesland && json.bundesland) {
          setBundesland(json.bundesland);
        }
      }
    } catch (err) {
      console.error("Error fetching holidays:", err);
    } finally {
      setLoading(false);
    }
  }, [year, bundesland]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("description")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={bundesland}
          onChange={(e) => setBundesland(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {Object.entries(BUNDESLAENDER).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Holiday list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : data ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <p className="text-sm font-medium text-gray-700">
              {data.bundeslandName} — {data.year} ({data.holidays.length}{" "}
              {t("holidaysCount")})
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {data.holidays.map((holiday, idx) => {
              const d = new Date(holiday.date + "T00:00:00");
              const weekday = d.toLocaleDateString("de-DE", {
                weekday: "long",
              });
              const dateFormatted = d.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });
              const isPast = d < new Date();

              return (
                <li
                  key={idx}
                  className={`flex items-center justify-between px-6 py-3 ${isPast ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${holiday.isNational ? "bg-red-500" : "bg-amber-500"}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {holiday.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {holiday.isNational ? t("national") : t("regional")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">{dateFormatted}</p>
                    <p className="text-xs text-gray-500">{weekday}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{t("noData")}</p>
      )}
    </div>
  );
}
