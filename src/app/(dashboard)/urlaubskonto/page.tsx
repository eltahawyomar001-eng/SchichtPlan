"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";

interface VacationBalance {
  id: string;
  year: number;
  totalEntitlement: number;
  carryOver: number;
  used: number;
  planned: number;
  remaining: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function UrlaubskontoSeite() {
  const t = useTranslations("vacationBalance");
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vacation-balances?year=${year}`);
      if (res.ok) setBalances(await res.json());
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
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
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : balances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
            <p className="text-sm text-gray-500">{t("empty")}</p>
            <p className="mt-1 text-xs text-gray-400">{t("emptyHint")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Header */}
                <div className="grid grid-cols-6 gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <div className="col-span-2">{t("employee")}</div>
                  <div className="text-center">{t("entitlement")}</div>
                  <div className="text-center">{t("used")}</div>
                  <div className="text-center">{t("planned")}</div>
                  <div className="text-center">{t("remaining")}</div>
                </div>

                {/* Rows */}
                {balances.map((bal) => (
                  <div
                    key={bal.id}
                    className="grid grid-cols-6 gap-4 border-b border-gray-100 px-6 py-3 last:border-0"
                  >
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-900">
                        {bal.employee.firstName} {bal.employee.lastName}
                      </p>
                      {bal.carryOver > 0 && (
                        <p className="text-xs text-gray-400">
                          +{bal.carryOver} {t("carryOver")}
                        </p>
                      )}
                    </div>
                    <div className="text-center text-sm text-gray-700">
                      {bal.totalEntitlement}
                    </div>
                    <div className="text-center text-sm text-gray-700">
                      {bal.used}
                    </div>
                    <div className="text-center text-sm text-amber-600">
                      {bal.planned}
                    </div>
                    <div className="text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-sm font-semibold ${
                          bal.remaining > 5
                            ? "bg-green-50 text-green-700"
                            : bal.remaining > 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {bal.remaining}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
