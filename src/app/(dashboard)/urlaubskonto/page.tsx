"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { EditIcon, XIcon } from "@/components/icons";

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
  const [editTarget, setEditTarget] = useState<VacationBalance | null>(null);
  const [editEntitlement, setEditEntitlement] = useState("");
  const [editCarryOver, setEditCarryOver] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const openEdit = (bal: VacationBalance) => {
    setEditTarget(bal);
    setEditEntitlement(String(bal.totalEntitlement));
    setEditCarryOver(String(bal.carryOver));
    setSaveMsg(null);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/vacation-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editTarget.employee.id,
          year,
          totalEntitlement: parseFloat(editEntitlement),
          carryOver: parseFloat(editCarryOver),
        }),
      });
      if (res.ok) {
        setSaveMsg({ type: "success", text: t("saved") });
        setEditTarget(null);
        fetchBalances();
      } else {
        const data = await res.json();
        setSaveMsg({ type: "error", text: data.error || t("saveError") });
      }
    } catch {
      setSaveMsg({ type: "error", text: t("networkError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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
                <div className="grid grid-cols-7 gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <div className="col-span-2">{t("employee")}</div>
                  <div className="text-center">{t("entitlement")}</div>
                  <div className="text-center">{t("used")}</div>
                  <div className="text-center">{t("planned")}</div>
                  <div className="text-center">{t("remaining")}</div>
                  <div className="text-center"></div>
                </div>

                {/* Rows */}
                {balances.map((bal) => (
                  <div
                    key={bal.id}
                    className="grid grid-cols-7 gap-4 border-b border-gray-100 px-6 py-3 last:border-0"
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
                    <div className="text-center">
                      <button
                        onClick={() => openEdit(bal)}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title={t("edit")}
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {t("editTitle")} – {editTarget.employee.firstName}{" "}
                {editTarget.employee.lastName}
              </h3>
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("entitlement")} ({t("daysPerYear")})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editEntitlement}
                  onChange={(e) => setEditEntitlement(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {t("entitlementHint")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("carryOver")} ({t("days")})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editCarryOver}
                  onChange={(e) => setEditCarryOver(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {saveMsg && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    saveMsg.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {saveMsg.text}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditTarget(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "..." : t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
