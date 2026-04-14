"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import { EditIcon, PalmtreeIcon, AlertTriangleIcon } from "@/components/icons";
import type { SessionUser } from "@/lib/types";

interface VacationBalance {
  id: string;
  year: number;
  totalEntitlement: number;
  carryOver: number;
  used: number;
  planned: number;
  remaining: number;
  legalMinimum: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    workDaysPerWeek: number;
    contractType: string;
  };
}

export default function UrlaubskontoSeite() {
  const t = useTranslations("vacationBalance");
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const isEmployee = user?.role === "EMPLOYEE";

  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      const res = await fetch(`/api/vacation-balances?year=${year}`);
      if (res.ok) {
        const data: unknown = await res.json();
        setBalances(Array.isArray(data) ? data : []);
      } else {
        setError(t("errorLoading"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Select
            value={String(year)}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="w-24"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />
      <PageContent>
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : balances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {t("empty")}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
              {t("emptyHint")}
            </p>
          </div>
        ) : isEmployee ? (
          /* ─── Employee: read-only card view of own balance ─── */
          <div className="space-y-4">
            {balances.map((bal) => (
              <div
                key={bal.id}
                className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
              >
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 dark:bg-zinc-800/50 px-6 py-4">
                  <PalmtreeIcon className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                    {bal.employee.firstName} {bal.employee.lastName} — {year}
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">
                  <div className="text-center rounded-lg border border-gray-100 bg-gray-50 dark:bg-zinc-800/50 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      {t("entitlement")}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                      {bal.totalEntitlement + bal.carryOver}
                    </p>
                    {bal.carryOver > 0 && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-500">
                        {bal.totalEntitlement} + {bal.carryOver}{" "}
                        {t("carryOver")}
                      </p>
                    )}
                  </div>
                  <div className="text-center rounded-lg border border-gray-100 bg-gray-50 dark:bg-zinc-800/50 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      {t("used")}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                      {bal.used}
                    </p>
                  </div>
                  <div className="text-center rounded-lg border border-gray-100 bg-gray-50 dark:bg-zinc-800/50 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      {t("planned")}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">
                      {bal.planned}
                    </p>
                  </div>
                  <div className="text-center rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
                      {t("remaining")}
                    </p>
                    <p
                      className={`mt-1 text-2xl font-bold ${
                        bal.remaining > 5
                          ? "text-emerald-700"
                          : bal.remaining > 0
                            ? "text-amber-700"
                            : "text-red-700"
                      }`}
                    >
                      {bal.remaining}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Carry-over deadline warning: show in Q1 if previous year carry-over exists */}
            {(() => {
              const now = new Date();
              const isQ1 = now.getMonth() < 3; // Jan, Feb, Mar
              const hasCarryOver =
                year === now.getFullYear() &&
                isQ1 &&
                balances.some((b) => b.carryOver > 0);
              if (!hasCarryOver) return null;
              return (
                <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("carryOverDeadline")}</p>
                    <p className="mt-0.5 text-amber-700">
                      {t("carryOverDeadlineDesc")}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Compliance warnings: entitlement below legal minimum */}
            {balances.some(
              (b) => b.totalEntitlement < (b.legalMinimum ?? 0),
            ) && (
              <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{t("belowMinimumWarning")}</p>
                  <p className="mt-0.5 text-red-700">
                    {t("belowMinimumWarningDesc")}
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="overflow-x-auto">
                <div className="min-w-[740px]">
                  {/* Header */}
                  <div className="grid grid-cols-8 gap-4 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    <div className="col-span-2">{t("employee")}</div>
                    <div className="text-center">{t("contractTypeLabel")}</div>
                    <div className="text-center">{t("entitlement")}</div>
                    <div className="text-center">{t("used")}</div>
                    <div className="text-center">{t("planned")}</div>
                    <div className="text-center">{t("remaining")}</div>
                    <div className="text-center"></div>
                  </div>

                  {/* Rows */}
                  {balances.map((bal) => {
                    const belowMin =
                      bal.totalEntitlement < (bal.legalMinimum ?? 0);
                    return (
                      <div
                        key={bal.id}
                        className={`grid grid-cols-8 gap-4 border-b border-gray-100 px-6 py-3 last:border-0 ${belowMin ? "bg-red-50/50" : ""}`}
                      >
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                            {bal.employee.firstName} {bal.employee.lastName}
                          </p>
                          {bal.carryOver > 0 && (
                            <p className="text-xs text-gray-400 dark:text-zinc-500">
                              +{bal.carryOver} {t("carryOver")}
                            </p>
                          )}
                          {belowMin && (
                            <p className="text-xs text-red-600 font-medium mt-0.5">
                              {t("belowMinShort", {
                                min: bal.legalMinimum,
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              bal.employee.contractType === "VOLLZEIT"
                                ? "bg-emerald-50 text-emerald-700"
                                : bal.employee.contractType === "TEILZEIT"
                                  ? "bg-blue-50 text-blue-700"
                                  : bal.employee.contractType === "MINIJOB"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-orange-50 text-orange-700"
                            }`}
                          >
                            {t(
                              `contract${bal.employee.contractType.charAt(0)}${bal.employee.contractType.slice(1).toLowerCase()}`,
                            )}
                          </span>
                        </div>
                        <div className="text-center text-sm text-gray-700 dark:text-zinc-300 self-center">
                          {bal.totalEntitlement}
                        </div>
                        <div className="text-center text-sm text-gray-700 dark:text-zinc-300 self-center">
                          {bal.used}
                        </div>
                        <div className="text-center text-sm text-amber-600 self-center">
                          {bal.planned}
                        </div>
                        <div className="text-center self-center">
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
                        <div className="text-center self-center">
                          <button
                            onClick={() => openEdit(bal)}
                            className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title={t("edit")}
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </PageContent>

      {/* Edit Modal */}
      <AdaptiveModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={
          editTarget
            ? `${t("editTitle")} – ${editTarget.employee.firstName} ${editTarget.employee.lastName}`
            : ""
        }
        size="md"
      >
        {editTarget && (
          <div className="space-y-4">
            {/* Legal minimum info */}
            {editTarget.legalMinimum && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <p className="font-medium">{t("legalMinInfo")}</p>
                <p className="mt-0.5">
                  {t("legalMinDetail", {
                    days: editTarget.legalMinimum,
                    workDays: editTarget.employee.workDaysPerWeek,
                  })}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                {t("entitlement")} ({t("daysPerYear")})
              </label>
              <Input
                type="number"
                min={editTarget.legalMinimum ?? 0}
                step="0.5"
                value={editEntitlement}
                onChange={(e) => setEditEntitlement(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                {t("entitlementHintDynamic", {
                  min: editTarget.legalMinimum ?? 20,
                  workDays: editTarget.employee.workDaysPerWeek ?? 5,
                })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                {t("carryOver")} ({t("days")})
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={editCarryOver}
                onChange={(e) => setEditCarryOver(e.target.value)}
              />
            </div>
            {saveMsg && (
              <div
                className={`rounded-xl p-3 text-sm ${
                  saveMsg.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {saveMsg.text}
              </div>
            )}
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "..." : t("save")}
              </Button>
            </ModalFooter>
          </div>
        )}
      </AdaptiveModal>
    </div>
  );
}
