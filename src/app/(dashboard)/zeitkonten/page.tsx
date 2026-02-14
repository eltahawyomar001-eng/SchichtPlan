"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  ScaleIcon,
  PlusIcon,
  XIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/components/icons";

// ─── Types ──────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  weeklyHours: number | null;
}

interface TimeAccount {
  id: string;
  contractHours: number;
  carryoverMinutes: number;
  currentBalance: number;
  periodStart: string;
  periodEnd: string | null;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  employee: Employee;
}

// ─── Helpers ────────────────────────────────────────────────────

function minutesToDisplay(minutes: number, suffix: string): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "+";
  return `${sign}${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function minutesToDecimal(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

// ─── Component ──────────────────────────────────────────────────

export default function ZeitkontenPage() {
  const t = useTranslations("timeAccounts");
  const tc = useTranslations("common");
  const hrsLabel = tc("hrsShort");
  const [accounts, setAccounts] = useState<TimeAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    employeeId: "",
    contractHours: "40",
    carryoverMinutes: "0",
    periodStart: new Date().getFullYear() + "-01-01",
  });

  // ── Fetch ───────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [accRes, empRes] = await Promise.all([
        fetch("/api/time-accounts"),
        fetch("/api/employees"),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (err) {
      console.error("Fehler:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Submit ──────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/time-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          contractHours: parseFloat(formData.contractHours),
          carryoverMinutes: parseInt(formData.carryoverMinutes) * 60, // convert hours to minutes
          periodStart: formData.periodStart,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          employeeId: "",
          contractHours: "40",
          carryoverMinutes: "0",
          periodStart: new Date().getFullYear() + "-01-01",
        });
        fetchData();
      }
    } catch (err) {
      console.error("Fehler:", err);
    }
  }

  // ── Summary ─────────────────────────────────────────────────

  const totalBalance = accounts.reduce((sum, a) => sum + a.balanceMinutes, 0);
  const overtimeEmployees = accounts.filter((a) => a.balanceMinutes > 0).length;
  const undertimeEmployees = accounts.filter(
    (a) => a.balanceMinutes < 0,
  ).length;
  const employeesWithAccount = new Set(accounts.map((a) => a.employee.id));

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t("createAccount")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2">
                  <ScaleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {minutesToDisplay(totalBalance, hrsLabel)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {t("totalBalance")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {overtimeEmployees}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {t("overtime")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {undertimeEmployees}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {t("undertime")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account list */}
        {loading ? (
          <p className="text-sm text-gray-500">{tc("loading")}</p>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ScaleIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("noAccounts")}</p>
              <p className="text-xs text-gray-400 mt-1">
                {t("noAccountsHint")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {accounts.map((account) => {
              const isPositive = account.balanceMinutes >= 0;
              return (
                <Card key={account.id}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{
                            backgroundColor:
                              account.employee.color || "#7C3AED",
                          }}
                        >
                          {account.employee.firstName.charAt(0)}
                          {account.employee.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {account.employee.firstName}{" "}
                            {account.employee.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t("contract")}: {account.contractHours}{" "}
                            {tc("hrsPerWeek")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={isPositive ? "success" : "destructive"}
                        className="text-sm font-bold shrink-0"
                      >
                        {minutesToDisplay(account.balanceMinutes, hrsLabel)}
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          {t("worked")}:{" "}
                          {minutesToDecimal(account.workedMinutes)}{" "}
                          {tc("hrsShort")}
                        </span>
                        <span>
                          {t("expected")}:{" "}
                          {minutesToDecimal(account.expectedMinutes)}{" "}
                          {tc("hrsShort")}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPositive ? "bg-green-500" : "bg-red-400"
                          }`}
                          style={{
                            width: `${Math.min(100, account.expectedMinutes > 0 ? (account.workedMinutes / account.expectedMinutes) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                      {account.carryoverMinutes !== 0 && (
                        <p className="text-xs text-gray-400">
                          {t("carryover")}:{" "}
                          {minutesToDisplay(account.carryoverMinutes, hrsLabel)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New Time Account Modal ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("form.title")}</CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 hover:bg-gray-100"
                >
                  <XIcon className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t("form.employee")}</Label>
                  <Select
                    value={formData.employeeId}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeId: e.target.value })
                    }
                    required
                  >
                    <option value="">{tc("selectPlaceholder")}</option>
                    {employees
                      .filter((emp) => !employeesWithAccount.has(emp.id))
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                  </Select>
                  {employees.length > 0 &&
                    employees.filter((emp) => !employeesWithAccount.has(emp.id))
                      .length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {t("allHaveAccounts")}
                      </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("form.weeklyHours")}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="48"
                      value={formData.contractHours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contractHours: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>{t("form.carryoverHours")}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.carryoverMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          carryoverMinutes: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {t("form.carryoverHint")}
                    </p>
                  </div>
                </div>

                <div>
                  <Label>{t("form.periodStart")}</Label>
                  <Input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) =>
                      setFormData({ ...formData, periodStart: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button type="submit">
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    {t("form.submit")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
