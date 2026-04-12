"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageContent } from "@/components/ui/page-content";
import {
  ChevronLeftIcon,
  MailIcon,
  PhoneIcon,
  BriefcaseIcon,
  ClockIcon,
  CalendarIcon,
  CalendarOffIcon,
  PalmtreeIcon,
  EditIcon,
} from "@/components/icons";

function statusVariant(
  status: string,
): "success" | "warning" | "outline" | "destructive" {
  if (
    ["COMPLETED", "BESTAETIGT", "GEPRUEFT", "GENEHMIGT", "CONFIRMED"].includes(
      status,
    )
  )
    return "success";
  if (
    ["AUSSTEHEND", "EINGEREICHT", "ENTWURF", "SCHEDULED", "OPEN"].includes(
      status,
    )
  )
    return "warning";
  if (
    [
      "ABGELEHNT",
      "ZURUECKGEWIESEN",
      "NO_SHOW",
      "CANCELLED",
      "STORNIERT",
    ].includes(status)
  )
    return "destructive";
  return "outline";
}

interface EmployeeDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  hourlyRate: number | null;
  weeklyHours: number | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  department: { id: string; name: string } | null;
  shifts: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    notes: string | null;
  }[];
  timeEntries: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    netMinutes: number;
    status: string;
  }[];
  absenceRequests: {
    id: string;
    category: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: string;
  }[];
  vacationBalances: {
    id: string;
    year: number;
    entitlement: number;
    totalEntitlement: number;
    carryOver: number;
    used: number;
    planned: number;
    remaining: number;
  }[];
}

function fmtDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("employeeDetail");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployee = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) {
        setError(t("notFound"));
        return;
      }
      setEmp(await res.json());
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !emp) {
    return (
      <div>
        <Topbar title={t("title")} />
        <div className="p-6">
          <Card>
            <CardContent className="py-12 sm:py-12 text-center text-sm text-gray-500 dark:text-zinc-400">
              {error || t("notFound")}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentBalance = emp.vacationBalances[0];

  return (
    <div>
      <Topbar
        title={`${emp.firstName} ${emp.lastName}`}
        description={emp.position || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/mitarbeiter")}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              {t("back")}
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/mitarbeiter?edit=${emp.id}`)}
            >
              <EditIcon className="h-4 w-4" />
              {tc("edit")}
            </Button>
          </div>
        }
      />

      <PageContent className="max-w-6xl">
        {/* ── Profile card ── */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Avatar
                name={`${emp.firstName} ${emp.lastName}`}
                color={emp.color || "#10b981"}
                size="lg"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {emp.firstName} {emp.lastName}
                  </h2>
                  <Badge variant={emp.isActive ? "success" : "outline"}>
                    {emp.isActive ? tc("active") : tc("inactive")}
                  </Badge>
                </div>
                {emp.position && (
                  <p className="text-sm text-gray-600 dark:text-zinc-400">
                    {emp.position}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-zinc-400">
                  {emp.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <MailIcon className="h-4 w-4 shrink-0" /> {emp.email}
                    </span>
                  )}
                  {emp.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <PhoneIcon className="h-4 w-4 shrink-0" /> {emp.phone}
                    </span>
                  )}
                  {emp.hourlyRate != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <BriefcaseIcon className="h-4 w-4 shrink-0" />
                      {emp.hourlyRate.toFixed(2)} €/h
                      {emp.weeklyHours != null &&
                        ` · ${emp.weeklyHours}${tc("hrsPerWeek")}`}
                    </span>
                  )}
                  {emp.department && (
                    <span className="inline-flex items-center gap-1.5">
                      {t("department")}: {emp.department.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-4 text-center">
              <CalendarIcon className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {emp.shifts.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {t("recentShifts")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-4 text-center">
              <ClockIcon className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {emp.timeEntries.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {t("recentTimeEntries")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-4 text-center">
              <CalendarOffIcon className="h-5 w-5 mx-auto text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {emp.absenceRequests.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {t("absences")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-4 text-center">
              <PalmtreeIcon className="h-5 w-5 mx-auto text-teal-600 mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {currentBalance ? currentBalance.remaining : "–"}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {t("vacationRemaining")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent shifts ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("shiftsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {emp.shifts.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-zinc-500 py-4 text-center">
                {t("noShifts")}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 dark:text-zinc-400">
                      <th className="px-6 pb-2 font-medium">{t("date")}</th>
                      <th className="px-6 pb-2 font-medium">{t("time")}</th>
                      <th className="px-6 pb-2 font-medium">{t("status")}</th>
                      <th className="px-6 pb-2 font-medium">{t("notes")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {emp.shifts.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-2 whitespace-nowrap">
                          {fmtDate(s.date, locale)}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          {s.startTime} – {s.endTime}
                        </td>
                        <td className="px-6 py-2">
                          <Badge variant={statusVariant(s.status)}>
                            {t.has(`shiftStatuses.${s.status}`)
                              ? t(`shiftStatuses.${s.status}`)
                              : s.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-2 text-gray-500 dark:text-zinc-400 truncate max-w-[200px]">
                          {s.notes || "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent time entries ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("timeEntriesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {emp.timeEntries.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-zinc-500 py-4 text-center">
                {t("noTimeEntries")}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 dark:text-zinc-400">
                      <th className="px-6 pb-2 font-medium">{t("date")}</th>
                      <th className="px-6 pb-2 font-medium">{t("time")}</th>
                      <th className="px-6 pb-2 font-medium">{t("breakMin")}</th>
                      <th className="px-6 pb-2 font-medium">{t("netMin")}</th>
                      <th className="px-6 pb-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {emp.timeEntries.map((te) => (
                      <tr
                        key={te.id}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-2 whitespace-nowrap">
                          {fmtDate(te.date, locale)}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          {te.startTime} – {te.endTime}
                        </td>
                        <td className="px-6 py-2">{te.breakMinutes}</td>
                        <td className="px-6 py-2">{te.netMinutes}</td>
                        <td className="px-6 py-2">
                          <Badge variant={statusVariant(te.status)}>
                            {t.has(`timeStatuses.${te.status}`)
                              ? t(`timeStatuses.${te.status}`)
                              : te.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Absence requests ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("absencesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {emp.absenceRequests.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-zinc-500 py-4 text-center">
                {t("noAbsences")}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 dark:text-zinc-400">
                      <th className="px-6 pb-2 font-medium">{t("category")}</th>
                      <th className="px-6 pb-2 font-medium">{t("period")}</th>
                      <th className="px-6 pb-2 font-medium">{t("days")}</th>
                      <th className="px-6 pb-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {emp.absenceRequests.map((ar) => (
                      <tr
                        key={ar.id}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-2">
                          {t.has(`absenceCategories.${ar.category}`)
                            ? t(`absenceCategories.${ar.category}`)
                            : ar.category}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          {fmtDate(ar.startDate, locale)} –{" "}
                          {fmtDate(ar.endDate, locale)}
                        </td>
                        <td className="px-6 py-2">{ar.totalDays}</td>
                        <td className="px-6 py-2">
                          <Badge variant={statusVariant(ar.status)}>
                            {t.has(`absenceStatuses.${ar.status}`)
                              ? t(`absenceStatuses.${ar.status}`)
                              : ar.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Vacation balance ── */}
        {currentBalance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("vacationTitle")} {currentBalance.year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    {currentBalance.totalEntitlement}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {t("entitlement")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    {currentBalance.carryOver}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {t("carryOver")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    {currentBalance.used}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {t("used")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    {currentBalance.planned}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {t("planned")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">
                    {currentBalance.remaining}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {t("remaining")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Created at footer ── */}
        <p className="text-xs text-gray-400 dark:text-zinc-500 text-center">
          {t("createdAt")}: {fmtDate(emp.createdAt, locale)}
        </p>
      </PageContent>
    </div>
  );
}
