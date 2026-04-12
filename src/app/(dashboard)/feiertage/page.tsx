"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageContent } from "@/components/ui/page-content";
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
  const tc = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = useState<HolidayResponse | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [bundesland, setBundesland] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (bundesland) params.set("bundesland", bundesland);
      const res = await fetch(`/api/holidays?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (!bundesland && json.bundesland) {
          setBundesland(json.bundesland);
        }
      } else {
        setError(tc("errorLoading"));
      }
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, bundesland]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Label>{t("year")}</Label>
            <Select
              value={String(year)}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-28"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("state")}</Label>
            <Select
              value={bundesland}
              onChange={(e) => setBundesland(e.target.value)}
              className="w-52"
            >
              {Object.entries(BUNDESLAENDER).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Holiday list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : data ? (
          <Card>
            <div className="border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-6 py-3">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 dark:text-zinc-300">
                {data.bundeslandName} — {data.year} ({data.holidays.length}{" "}
                {t("holidaysCount")})
              </p>
            </div>
            <CardContent className="p-0 sm:p-0">
              <ul className="divide-y divide-gray-100">
                {data.holidays.map((holiday, idx) => {
                  const d = new Date(holiday.date + "T00:00:00");
                  const weekday = d.toLocaleDateString(
                    locale === "en" ? "en-GB" : "de-DE",
                    { weekday: "long" },
                  );
                  const dateFormatted = d.toLocaleDateString(
                    locale === "en" ? "en-GB" : "de-DE",
                    { day: "2-digit", month: "2-digit", year: "numeric" },
                  );
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
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 dark:text-zinc-100">
                            {holiday.name}
                          </p>
                          <Badge
                            className={`text-xs ${holiday.isNational ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {holiday.isNational ? t("national") : t("regional")}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900 dark:text-zinc-100 dark:text-zinc-100">
                          {dateFormatted}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400">
                          {weekday}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-12 sm:py-12">
              <p className="text-sm text-gray-500 dark:text-zinc-400 dark:text-zinc-400">
                {t("noData")}
              </p>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </div>
  );
}
