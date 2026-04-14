import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UsersIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CalendarOffIcon,
  SwapIcon,
  RocketIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";
import { isManagement } from "@/lib/authorization";
import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import {
  DashboardSkeleton,
  EmployeeDashboardSkeleton,
} from "./_components/dashboard-skeleton";
import { FavoritesSection } from "./_components/favorites-section";
import {
  LiveOverviewCard,
  type LiveEmployee,
  type LiveStatus,
} from "./_components/live-overview-card";
import {
  OvertimeTrackerCard,
  type OvertimeEmployee,
} from "./_components/overtime-tracker-card";
import {
  ShiftCoverageCard,
  type CoverageDay,
} from "./_components/shift-coverage-card";
import {
  TeamCalendarMiniCard,
  type CalendarDay,
} from "./_components/team-calendar-mini-card";
import {
  CelebrationsCard,
  type CelebrationEntry,
} from "./_components/celebrations-card";
import { WeatherCard, type WeatherLocation } from "./_components/weather-card";
import {
  ComplianceAlertsCard,
  type ComplianceAlert,
  type AlertSeverity,
} from "./_components/compliance-alerts-card";
import {
  HoursChartCard,
  type DailyHours,
} from "./_components/hours-chart-card";
import {
  WorkforceStatsGrid,
  type WorkforceStat,
} from "./_components/workforce-stats-grid";
import {
  AbsenteeismCard,
  type AbsentEmployee,
} from "./_components/absenteeism-card";
import {
  PendingRequestsCard,
  type PendingRequest,
} from "./_components/pending-requests-card";
import {
  LocationDistributionCard,
  type LocationGroup,
} from "./_components/location-distribution-card";
import {
  RecentActivityCard,
  type ActivityEvent,
  type ActivityType,
} from "./_components/recent-activity-card";
import {
  LiveProjectsCard,
  type LiveProject,
} from "./_components/live-projects-card";

export const revalidate = 0;

interface ShiftWithRelations {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  employee: { firstName: string; lastName: string; color: string | null };
  location: { name: string } | null;
}

/* ── Helper: Berlin "today" bounds ──
 * For @db.Date (PostgreSQL DATE) fields Prisma truncates DateTime to
 * the date part, so  `date < '2026-04-14T23:59:59'`  becomes
 * `date < '2026-04-14'`  which **excludes** today.
 * Fix: use `tomorrow` (next day at 00:00) and keep `lt: tomorrow`.
 * This is correct for both DATE and TIMESTAMP columns.
 */
function getTodayBounds() {
  const berlinDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Berlin",
  });
  const todayStart = new Date(`${berlinDate}T00:00:00.000Z`);
  const tomorrow = new Date(todayStart.getTime() + 86_400_000); // +24h
  return { todayStart, tomorrow };
}

/* ── Helper: shift status label ── */
function getStatusLabel(t: Awaited<ReturnType<typeof getTranslations>>) {
  return (s: string) => {
    const map: Record<string, string> = {
      SCHEDULED: t("shiftStatuses.SCHEDULED"),
      CONFIRMED: t("shiftStatuses.CONFIRMED"),
      IN_PROGRESS: t("shiftStatuses.IN_PROGRESS"),
      COMPLETED: t("shiftStatuses.COMPLETED"),
      CANCELLED: t("shiftStatuses.CANCELLED"),
      NO_SHOW: t("shiftStatuses.NO_SHOW"),
    };
    return map[s] || s;
  };
}

/* ══════════════════════════════════════════════════════════════
 * Page component — renders Topbar immediately (LCP),
 * streams data sections via Suspense
 * ══════════════════════════════════════════════════════════════ */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser;
  const workspaceId = user?.workspaceId;
  const t = await getTranslations("dashboard");
  const to = await getTranslations("onboarding");

  if (!workspaceId) {
    return (
      <div>
        <Topbar title={t("title")} description="" />
        <div className="flex items-center justify-center py-20">
          <Card className="mx-4 max-w-md">
            <CardContent className="p-8 sm:p-8 text-center">
              <RocketIcon className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <CardTitle className="mb-2">{to("welcome")}</CardTitle>
              <p className="text-sm text-gray-500 mb-6">{to("setupDesc")}</p>
              <Link
                href="/einstellungen"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
              >
                {to("setupButton")}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isManager = user ? isManagement(user) : false;

  if (!isManager) {
    return (
      <div>
        <Topbar title={t("title")} description={t("employeeDashboardDesc")} />
        <Suspense fallback={<EmployeeDashboardSkeleton />}>
          <EmployeeDashboardContent
            workspaceId={workspaceId}
            employeeId={user?.employeeId ?? undefined}
            userId={user.id}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <Suspense fallback={<DashboardSkeleton />}>
        <ManagerDashboardContent workspaceId={workspaceId} userId={user.id} />
      </Suspense>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Employee Dashboard — async server component (streamed)
 * ══════════════════════════════════════════════════════════════ */
async function EmployeeDashboardContent({
  workspaceId,
  employeeId,
  userId,
}: {
  workspaceId: string;
  employeeId?: string;
  userId: string;
}) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const statusLabel = getStatusLabel(t);
  const { todayStart, tomorrow } = getTodayBounds();

  const [
    myTodayShifts,
    myUpcomingShifts,
    myPendingAbsences,
    myPendingSwaps,
    currentUser,
  ] = await Promise.all([
    employeeId
      ? prisma.shift.findMany({
          where: {
            workspaceId,
            employeeId,
            date: { gte: todayStart, lt: tomorrow },
          },
          include: { employee: true, location: true },
          orderBy: { startTime: "asc" },
        })
      : Promise.resolve([]),
    employeeId
      ? prisma.shift.findMany({
          where: {
            workspaceId,
            employeeId,
            date: { gte: tomorrow },
          },
          include: { employee: true, location: true },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 5,
        })
      : Promise.resolve([]),
    employeeId
      ? prisma.absenceRequest.count({
          where: { workspaceId, employeeId, status: "AUSSTEHEND" },
        })
      : Promise.resolve(0),
    employeeId
      ? prisma.shiftSwapRequest.count({
          where: {
            workspaceId,
            requesterId: employeeId,
            status: "ANGEFRAGT",
          },
        })
      : Promise.resolve(0),
    prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardFavorites: true },
    }),
  ]);

  const favorites: string[] = currentUser?.dashboardFavorites
    ? JSON.parse(currentUser.dashboardFavorites)
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <FavoritesSection initialFavorites={favorites} />

      {(myPendingAbsences > 0 || myPendingSwaps > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("myPendingRequests")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myPendingAbsences > 0 && (
                <Link
                  href="/abwesenheiten"
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 hover:border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 p-2">
                      <CalendarOffIcon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      {t("pendingAbsences", { count: myPendingAbsences })}
                    </p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                </Link>
              )}
              {myPendingSwaps > 0 && (
                <Link
                  href="/schichttausch"
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 hover:border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 p-2">
                      <SwapIcon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      {t("pendingSwaps", { count: myPendingSwaps })}
                    </p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("myShiftsToday")}</CardTitle>
        </CardHeader>
        <CardContent>
          {(myTodayShifts as ShiftWithRelations[]).length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t("noShiftsToday")}</p>
          ) : (
            <div className="space-y-3">
              {(myTodayShifts as ShiftWithRelations[]).map((shift) => (
                <div
                  key={shift.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 dark:bg-zinc-800/50 p-4"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-sm"
                      style={{
                        backgroundColor: shift.employee.color || "#10b981",
                      }}
                    >
                      {shift.employee.firstName.charAt(0)}
                      {shift.employee.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {shift.startTime} - {shift.endTime}
                      </p>
                      {shift.location && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {shift.location.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm text-gray-500">
                      {statusLabel(shift.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(myUpcomingShifts as ShiftWithRelations[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("upcomingShifts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(myUpcomingShifts as ShiftWithRelations[]).map((shift) => (
                <div
                  key={shift.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 dark:bg-zinc-800/50 p-4"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-sm"
                      style={{
                        backgroundColor: shift.employee.color || "#10b981",
                      }}
                    >
                      {shift.employee.firstName.charAt(0)}
                      {shift.employee.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {shift.startTime} - {shift.endTime}
                      </p>
                      {shift.location && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {shift.location.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-gray-400">
                      {new Date(shift.date).toLocaleDateString(
                        locale === "en" ? "en-GB" : "de-DE",
                      )}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      {statusLabel(shift.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Manager Dashboard — async server component (streamed)
 * ══════════════════════════════════════════════════════════════ */
async function ManagerDashboardContent({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const t = await getTranslations("dashboard");
  const to = await getTranslations("onboarding");
  const locale = await getLocale();
  const localeFmt = locale === "en" ? "en-GB" : "de-DE";
  const statusLabel = getStatusLabel(t);
  const { todayStart, tomorrow } = getTodayBounds();

  /* ── Date ranges for widget queries ── */
  const berlinDateStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Berlin",
  });
  const berlinNow = new Date(`${berlinDateStr}T12:00:00.000Z`);
  const dayOfWeek = berlinNow.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(berlinNow);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  const monthStart = new Date(`${berlinDateStr.slice(0, 7)}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setMilliseconds(-1);

  /* ── Date ranges for chart ── */
  const yearStart = new Date(
    `${berlinDateStr.slice(0, 4)}-01-01T00:00:00.000Z`,
  );
  const yearEnd = new Date(`${berlinDateStr.slice(0, 4)}-12-31T23:59:59.999Z`);

  const [
    employeeCount,
    shiftCount,
    locationCount,
    todayShifts,
    pendingAbsences,
    pendingSwaps,
    pendingTimeEntries,
    currentUser,
    liveTimeEntries,
    weekShiftsForCoverage,
    monthShiftsForCalendar,
    monthAbsencesForCalendar,
    allActiveEmployees,
    weatherLocations,
    complianceTimeEntries,
    timeAccounts,
    weekTimeEntries,
    monthTimeEntries,
    yearTimeEntries,
    activeAbsences,
    pendingAbsenceRequests,
    allLocationsWithEmployees,
    recentTimeEntries,
    liveProjectEntries,
  ] = await Promise.all([
    prisma.employee.count({ where: { workspaceId, isActive: true } }),
    prisma.shift.count({ where: { workspaceId } }),
    prisma.location.count({ where: { workspaceId } }),
    prisma.shift.findMany({
      where: { workspaceId, date: { gte: todayStart, lt: tomorrow } },
      include: { employee: true, location: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.absenceRequest.count({
      where: { workspaceId, status: "AUSSTEHEND" },
    }),
    prisma.shiftSwapRequest.count({
      where: { workspaceId, status: "ANGEFRAGT" },
    }),
    prisma.timeEntry.count({ where: { workspaceId, status: "EINGEREICHT" } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardFavorites: true },
    }),
    /* Widget: Live Overview */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        clockInAt: { not: null },
        isLiveClock: true,
        date: { gte: todayStart, lt: tomorrow },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
            location: { select: { name: true } },
          },
        },
      },
      orderBy: { clockInAt: "desc" },
    }),
    /* Widget: Shift Coverage */
    prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: weekStart, lte: weekEnd },
        deletedAt: null,
      },
      select: { date: true, status: true, employeeId: true },
    }),
    /* Widget: Calendar — shifts */
    prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { date: true },
    }),
    /* Widget: Calendar — absences */
    prisma.absenceRequest.findMany({
      where: {
        workspaceId,
        status: "GENEHMIGT",
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { startDate: true, endDate: true },
    }),
    /* Widget: Celebrations + Employee lookup */
    prisma.employee.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        color: true,
        createdAt: true,
      },
    }),
    /* Widget: Weather — locations */
    prisma.location.findMany({
      where: { workspaceId },
      select: { id: true, name: true, address: true },
      orderBy: { name: "asc" },
    }),
    /* Widget: Compliance */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        date: { gte: new Date(todayStart.getTime() - 86400000), lt: tomorrow },
        deletedAt: null,
        clockOutAt: { not: null },
      },
      select: {
        employeeId: true,
        date: true,
        clockInAt: true,
        clockOutAt: true,
        grossMinutes: true,
        netMinutes: true,
        breakMinutes: true,
      },
      orderBy: { clockInAt: "asc" },
    }),
    /* Widget: Overtime */
    prisma.timeAccount.findMany({
      where: { workspaceId },
      select: { currentBalance: true, contractHours: true, employeeId: true },
    }),
    /* Widget: Hours Chart — week */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: weekStart, lte: weekEnd },
        status: { not: "ENTWURF" },
      },
      select: { date: true, netMinutes: true },
    }),
    /* Widget: Hours Chart — month */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
        status: { not: "ENTWURF" },
      },
      select: { date: true, netMinutes: true },
    }),
    /* Widget: Hours Chart — year */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: yearStart, lte: yearEnd },
        status: { not: "ENTWURF" },
      },
      select: { date: true, netMinutes: true },
    }),
    /* Widget: Absenteeism — active today */
    prisma.absenceRequest.findMany({
      where: {
        workspaceId,
        status: "GENEHMIGT",
        startDate: { lt: tomorrow },
        endDate: { gte: todayStart },
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, color: true },
        },
      },
    }),
    /* Widget: Pending Requests */
    prisma.absenceRequest.findMany({
      where: { workspaceId, status: "AUSSTEHEND" },
      include: {
        employee: { select: { firstName: true, lastName: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    /* Widget: Location Distribution */
    prisma.location.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        employees: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, color: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    /* Widget: Recent Activity */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        date: { gte: todayStart, lt: tomorrow },
        clockInAt: { not: null },
        deletedAt: null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        project: { select: { name: true } },
      },
      orderBy: { clockInAt: "desc" },
      take: 10,
    }),
    /* Widget: Live Projects */
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        isLiveClock: true,
        clockOutAt: null,
        date: { gte: todayStart, lt: tomorrow },
        projectId: { not: null },
      },
      include: {
        employee: { select: { firstName: true, lastName: true, color: true } },
        project: { select: { name: true } },
      },
      orderBy: { clockInAt: "desc" },
    }),
  ]);

  const favorites: string[] = currentUser?.dashboardFavorites
    ? JSON.parse(currentUser.dashboardFavorites)
    : [];

  const stats = [
    {
      title: t("employees"),
      value: employeeCount,
      icon: UsersIcon,
      color: "text-emerald-600",
      bg: "stat-icon-emerald",
    },
    {
      title: t("totalShifts"),
      value: shiftCount,
      icon: CalendarIcon,
      color: "text-emerald-600",
      bg: "stat-icon-emerald",
    },
    {
      title: t("locations"),
      value: locationCount,
      icon: MapPinIcon,
      color: "text-emerald-600",
      bg: "stat-icon-emerald",
    },
    {
      title: t("shiftsToday"),
      value: todayShifts.length,
      icon: ClockIcon,
      color: "text-emerald-600",
      bg: "stat-icon-emerald",
    },
  ];

  const showOnboarding =
    locationCount === 0 || employeeCount === 0 || shiftCount === 0;

  const onboardingSteps = [
    {
      title: to("step1Title"),
      desc: to("step1Desc"),
      done: locationCount > 0,
      href: "/standorte",
      icon: MapPinIcon,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    },
    {
      title: to("step2Title"),
      desc: to("step2Desc"),
      done: employeeCount > 0,
      href: "/mitarbeiter",
      icon: UsersIcon,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    },
    {
      title: to("step3Title"),
      desc: to("step3Desc"),
      done: shiftCount > 0,
      href: "/schichtplan",
      icon: CalendarIcon,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    },
  ];

  const totalPending = pendingAbsences + pendingSwaps + pendingTimeEntries;

  const pendingItems = [
    {
      count: pendingAbsences,
      label: t("pendingAbsences", { count: pendingAbsences }),
      href: "/abwesenheiten",
      icon: CalendarOffIcon,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    },
    {
      count: pendingSwaps,
      label: t("pendingSwaps", { count: pendingSwaps }),
      href: "/schichttausch",
      icon: SwapIcon,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    },
    {
      count: pendingTimeEntries,
      label: t("pendingTimeEntries", { count: pendingTimeEntries }),
      href: "/zeiterfassung",
      icon: ClockIcon,
      color: "text-emerald-600",
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    },
  ].filter((item) => item.count > 0);

  /* ══════════════════════════════════════════════════════════
   * Widget data processing
   * ══════════════════════════════════════════════════════════ */

  const empMap = new Map(allActiveEmployees.map((e) => [e.id, e]));

  /* ── Widget: Live Overview ── */
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const nowMs = Date.now();
  const liveEmployees: LiveEmployee[] = liveTimeEntries
    .filter((e) => e.employee)
    .map((entry) => {
      const hasBreakStart = !!entry.breakStart;
      const hasBreakEnd = !!entry.breakEnd;
      const isOnBreak = hasBreakStart && !hasBreakEnd;
      const isClockedOut = !!entry.clockOutAt;
      const status: LiveStatus = isClockedOut
        ? "clocked_out"
        : isOnBreak
          ? "break"
          : "working";
      const clockIn = entry.clockInAt ? new Date(entry.clockInAt) : null;
      const sinceStr = clockIn
        ? clockIn.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Berlin",
          })
        : undefined;
      const elapsedMs = clockIn ? nowMs - clockIn.getTime() : 0;
      const elapsedH = Math.floor(elapsedMs / 3600000);
      const elapsedM = Math.floor((elapsedMs % 3600000) / 60000);
      const duration = elapsedMs > 0 ? `${elapsedH}h ${elapsedM}m` : undefined;
      return {
        id: entry.employee!.id,
        firstName: entry.employee!.firstName,
        lastName: entry.employee!.lastName,
        color: entry.employee!.color,
        status,
        since: sinceStr,
        duration,
        location: entry.employee!.location?.name,
      };
    });
  const liveEmployeeMap = new Map<string, LiveEmployee>();
  for (const emp of liveEmployees) liveEmployeeMap.set(emp.id, emp);
  const uniqueLiveEmployees = Array.from(liveEmployeeMap.values()).sort(
    (a, b) => {
      const order: Record<LiveStatus, number> = {
        working: 0,
        break: 1,
        clocked_out: 2,
      };
      return order[a.status] - order[b.status];
    },
  );

  /* ── Widget: Overtime Tracker ── */
  const overtimeEmployees: OvertimeEmployee[] = timeAccounts
    .filter((ta) => ta.currentBalance !== 0)
    .map((ta) => {
      const emp = empMap.get(ta.employeeId);
      return {
        id: ta.employeeId,
        firstName: emp?.firstName ?? "–",
        lastName: emp?.lastName ?? "",
        color: emp?.color ?? null,
        overtimeMinutes: ta.currentBalance,
        contractHours: ta.contractHours,
      };
    })
    .sort((a, b) => Math.abs(b.overtimeMinutes) - Math.abs(a.overtimeMinutes))
    .slice(0, 8);

  /* ── Widget: Shift Coverage ── */
  const dayNamesShort =
    locale === "en"
      ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
      : ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const coverageDays: CoverageDay[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + d);
    const dayStr = day.toLocaleDateString("en-CA", {
      timeZone: "Europe/Berlin",
    });
    const dayShifts = weekShiftsForCoverage.filter(
      (s) =>
        new Date(s.date).toLocaleDateString("en-CA", {
          timeZone: "Europe/Berlin",
        }) === dayStr,
    );
    const total = dayShifts.length;
    const open = dayShifts.filter(
      (s) => s.status === "OPEN" || !s.employeeId,
    ).length;
    coverageDays.push({
      date: dayStr,
      label: `${dayNamesShort[day.getDay()]} ${day.toLocaleDateString(localeFmt, { day: "numeric", month: "numeric" })}`,
      totalShifts: total,
      filledShifts: total - open,
      openShifts: open,
    });
  }

  /* ── Widget: Team Calendar Mini ── */
  const calYear = monthStart.getFullYear();
  const calMonth = monthStart.getMonth();
  const firstOfMonth = new Date(calYear, calMonth, 1);
  const calStart = new Date(firstOfMonth);
  const firstDow = calStart.getDay();
  const calMondayOff = firstDow === 0 ? -6 : 1 - firstDow;
  calStart.setDate(calStart.getDate() + calMondayOff);
  const calendarDays: CalendarDay[] = [];
  const berlinToday = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }),
  );
  const todayIso = berlinToday.toLocaleDateString("en-CA");
  const shiftDateSet = new Set(
    monthShiftsForCalendar.map((s) =>
      new Date(s.date).toLocaleDateString("en-CA"),
    ),
  );
  const absenceDateSet = new Set<string>();
  for (const abs of monthAbsencesForCalendar) {
    const start = new Date(abs.startDate);
    const end = new Date(abs.endDate);
    for (let dd = new Date(start); dd <= end; dd.setDate(dd.getDate() + 1)) {
      absenceDateSet.add(dd.toLocaleDateString("en-CA"));
    }
  }
  for (let i = 0; i < 42; i++) {
    const cd = new Date(calStart);
    cd.setDate(cd.getDate() + i);
    const iso = cd.toLocaleDateString("en-CA");
    calendarDays.push({
      date: iso,
      day: cd.getDate(),
      isToday: iso === todayIso,
      isCurrentMonth: cd.getMonth() === calMonth,
      hasShifts: shiftDateSet.has(iso),
      hasAbsences: absenceDateSet.has(iso),
      shiftCount: monthShiftsForCalendar.filter(
        (s) => new Date(s.date).toLocaleDateString("en-CA") === iso,
      ).length,
      absenceCount: absenceDateSet.has(iso) ? 1 : 0,
    });
  }
  const monthLabelStr = firstOfMonth.toLocaleDateString(localeFmt, {
    month: "long",
    year: "numeric",
  });
  const calDayLabels = [
    t("widgets.dayMo"),
    t("widgets.dayTu"),
    t("widgets.dayWe"),
    t("widgets.dayTh"),
    t("widgets.dayFr"),
    t("widgets.daySa"),
    t("widgets.daySu"),
  ];

  /* ── Widget: Celebrations ── */
  const berlinTodayMs = berlinToday.getTime();
  const celebrations: CelebrationEntry[] = [];
  for (const emp of allActiveEmployees) {
    const hireDate = new Date(emp.createdAt);
    const yearsWorked = berlinToday.getFullYear() - hireDate.getFullYear();
    if (yearsWorked >= 1) {
      const anniv = new Date(
        berlinToday.getFullYear(),
        hireDate.getMonth(),
        hireDate.getDate(),
      );
      const diff = Math.floor((anniv.getTime() - berlinTodayMs) / 86400000);
      if (diff >= 0 && diff <= 7) {
        celebrations.push({
          id: `ann_${emp.id}`,
          firstName: emp.firstName,
          lastName: emp.lastName,
          color: emp.color,
          type: "anniversary",
          date: anniv.toLocaleDateString(localeFmt),
          detail: t("widgets.yearsAnniversary", { count: yearsWorked }),
          daysUntil: diff,
        });
      }
    }
  }
  celebrations.sort((a, b) => a.daysUntil - b.daysUntil);

  /* ── Widget: Weather ── */
  const weatherLocs: WeatherLocation[] = weatherLocations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    geocodeQuery: loc.address || loc.name,
  }));

  /* ── Widget: Compliance Alerts ── */
  const complianceAlerts: ComplianceAlert[] = [];
  const compByEmployee = new Map<string, typeof complianceTimeEntries>();
  for (const entry of complianceTimeEntries) {
    const existing = compByEmployee.get(entry.employeeId) ?? [];
    existing.push(entry);
    compByEmployee.set(entry.employeeId, existing);
  }
  for (const [empId, entries] of compByEmployee) {
    const emp = empMap.get(empId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : "–";
    for (const entry of entries) {
      if (entry.grossMinutes > 600) {
        complianceAlerts.push({
          id: `max_${entry.employeeId}_${entry.date}`,
          severity: "critical" as AlertSeverity,
          title: t("widgets.maxHoursViolation"),
          description: t("widgets.maxHoursDesc"),
          employeeName: empName,
          date: new Date(entry.date).toLocaleDateString(localeFmt),
          href: "/zeiterfassung",
        });
      }
      if (entry.grossMinutes > 360 && entry.breakMinutes < 30) {
        complianceAlerts.push({
          id: `break_${entry.employeeId}_${entry.date}`,
          severity: "warning" as AlertSeverity,
          title: t("widgets.missingBreak"),
          description: t("widgets.missingBreakDesc"),
          employeeName: empName,
          date: new Date(entry.date).toLocaleDateString(localeFmt),
          href: "/zeiterfassung",
        });
      }
    }
    const sorted = [...entries]
      .filter((e) => e.clockOutAt)
      .sort(
        (a, b) =>
          new Date(a.clockInAt!).getTime() - new Date(b.clockInAt!).getTime(),
      );
    for (let i = 0; i < sorted.length - 1; i++) {
      const outTime = new Date(sorted[i].clockOutAt!).getTime();
      const nextIn = new Date(sorted[i + 1].clockInAt!).getTime();
      const restHours = (nextIn - outTime) / 3600000;
      if (restHours < 11 && restHours >= 0) {
        complianceAlerts.push({
          id: `rest_${empId}_${i}`,
          severity: "critical" as AlertSeverity,
          title: t("widgets.restPeriodViolation"),
          description: t("widgets.restPeriodDesc"),
          employeeName: empName,
          href: "/zeiterfassung",
        });
      }
    }
  }

  /* ── Widget: Hours Chart ── */
  function aggregateHours(
    entries: { date: Date; netMinutes: number }[],
    mode: "day" | "month",
  ): DailyHours[] {
    const map = new Map<string, number>();
    for (const e of entries) {
      const key =
        mode === "day"
          ? new Date(e.date).toLocaleDateString("en-CA")
          : new Date(e.date).toLocaleDateString("en-CA").slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + e.netMinutes);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, mins]) => ({
        date: key,
        label:
          mode === "day"
            ? new Date(key).toLocaleDateString(localeFmt, {
                day: "numeric",
                month: "numeric",
              })
            : new Date(`${key}-15`).toLocaleDateString(localeFmt, {
                month: "short",
              }),
        hours: Math.round((mins / 60) * 10) / 10,
      }));
  }

  const weekChartData = aggregateHours(
    weekTimeEntries as { date: Date; netMinutes: number }[],
    "day",
  );
  const monthChartData = aggregateHours(
    monthTimeEntries as { date: Date; netMinutes: number }[],
    "day",
  );
  const yearChartData = aggregateHours(
    yearTimeEntries as { date: Date; netMinutes: number }[],
    "month",
  );

  const chartDateRange = `${weekStart.toLocaleDateString(localeFmt)} – ${weekEnd.toLocaleDateString(localeFmt)}`;

  /* ── Widget: Workforce Stats ── */
  const totalOvertimeMin = timeAccounts.reduce(
    (sum, ta) => sum + ta.currentBalance,
    0,
  );
  const workforceStats: WorkforceStat[] = [
    {
      id: "active",
      label: t("employees"),
      value: String(employeeCount),
      numericValue: employeeCount,
    },
    {
      id: "absent",
      label: t("widgets.absent"),
      value: String(activeAbsences.length),
      numericValue: activeAbsences.length,
    },
    {
      id: "overtime",
      label: t("widgets.overtime"),
      value: `${totalOvertimeMin >= 0 ? "+" : ""}${Math.round(totalOvertimeMin / 60)} ${t("widgets.hrs")}`,
      numericValue: totalOvertimeMin,
    },
    {
      id: "pending",
      label: t("pendingItems"),
      value: String(totalPending),
      numericValue: totalPending,
    },
  ];

  /* ── Widget: Absenteeism ── */
  const absentEmployees: AbsentEmployee[] = activeAbsences.map((abs) => ({
    id: abs.employee.id,
    firstName: abs.employee.firstName,
    lastName: abs.employee.lastName,
    color: abs.employee.color,
    category: abs.category,
    daysRemaining: Math.max(
      0,
      Math.ceil((new Date(abs.endDate).getTime() - nowMs) / 86400000),
    ),
  }));

  /* ── Widget: Pending Requests ── */
  const pendingReqs: PendingRequest[] = pendingAbsenceRequests.map((req) => ({
    id: req.id,
    employee: {
      firstName: req.employee.firstName,
      lastName: req.employee.lastName,
      color: req.employee.color,
    },
    category: req.category,
    startDate: new Date(req.startDate).toLocaleDateString(localeFmt),
    endDate: new Date(req.endDate).toLocaleDateString(localeFmt),
  }));

  /* ── Widget: Location Distribution ── */
  const locationColors = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  const locationGroups: LocationGroup[] = (
    allLocationsWithEmployees as {
      id: string;
      name: string;
      employees: {
        id: string;
        firstName: string;
        lastName: string;
        color: string | null;
      }[];
    }[]
  ).map((loc, i) => ({
    id: loc.id,
    name: loc.name,
    color: locationColors[i % locationColors.length],
    barColor: locationColors[i % locationColors.length],
    employees: loc.employees,
  }));
  const totalDistEmployees = locationGroups.reduce(
    (s, l) => s + l.employees.length,
    0,
  );

  /* ── Widget: Recent Activity ── */
  const activityEvents: ActivityEvent[] = recentTimeEntries
    .filter((e) => e.employee)
    .map((entry) => {
      const empName = `${entry.employee.lastName}, ${entry.employee.firstName}`;
      const time = entry.clockInAt
        ? new Date(entry.clockInAt).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Berlin",
          })
        : entry.startTime;
      let actType: ActivityType = "clock_in";
      if (entry.clockOutAt) actType = "clock_out";
      else if (entry.breakStart && !entry.breakEnd) actType = "break_start";
      else if (entry.breakEnd) actType = "break_end";
      else if (entry.project) actType = "project";
      const label = entry.project?.name ?? t("widgets.workTime");
      return {
        id: entry.id,
        type: actType,
        time,
        employeeName: empName,
        label,
      };
    });

  /* ── Widget: Live Projects ── */
  const liveProjects: LiveProject[] = liveProjectEntries
    .filter((e) => e.employee && e.project)
    .map((entry) => {
      const clockIn = entry.clockInAt ? new Date(entry.clockInAt) : new Date();
      const startStr = clockIn.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      });
      const elapsed = nowMs - clockIn.getTime();
      const progressPercent = Math.min(
        100,
        Math.round((elapsed / (8 * 3600000)) * 100),
      );
      return {
        id: entry.id,
        projectName: entry.project!.name,
        startTime: startStr,
        sinceLabel: t("widgets.since", { time: startStr }),
        progressPercent,
        employee: {
          name: `${entry.employee.firstName} ${entry.employee.lastName}`,
          color: entry.employee.color,
        },
      };
    });

  /* ── Widget: Absence category label ── */
  const categoryLabel = (cat: string) => {
    const catMap: Record<string, string> = {
      URLAUB: t("widgets.vacation"),
      KRANKHEIT: t("widgets.illness"),
      SONDERURLAUB: t("widgets.specialLeave"),
      ELTERNZEIT: t("widgets.parentalLeave"),
      FORTBILDUNG: t("widgets.training"),
      UNBEZAHLT: t("widgets.unpaid"),
      HOMEOFFICE: t("widgets.homeoffice"),
      SONSTIGES: t("widgets.other"),
    };
    return catMap[cat] ?? cat;
  };

  /* ══════════════════════════════════════════════════════════
   * Render
   * ══════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Onboarding Wizard */}
      {showOnboarding && (
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-2 shadow-sm">
                <RocketIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  {to("welcomeTitle")}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  {to("welcomeSubtitle")}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{to("progress") || "Fortschritt"}</span>
                <span>
                  {onboardingSteps.filter((s) => s.done).length}/
                  {onboardingSteps.length}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${(onboardingSteps.filter((s) => s.done).length / onboardingSteps.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {onboardingSteps.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 sm:gap-4 rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ${
                    step.done
                      ? "border-green-100 bg-green-50/40"
                      : "border-gray-100 bg-white dark:bg-zinc-900 hover:border-emerald-200 hover:shadow-sm"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 rounded-xl p-2.5 ${step.done ? "bg-green-100" : step.bg}`}
                  >
                    {step.done ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <step.icon className={`h-5 w-5 ${step.color}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium text-sm ${step.done ? "text-green-700 line-through" : "text-gray-900"}`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                  {step.done ? (
                    <span className="text-xs font-medium text-green-600 flex-shrink-0">
                      {to("completed")} ✓
                    </span>
                  ) : (
                    <Link
                      href={step.href}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                    >
                      <span className="hidden sm:inline">{to("goTo")}</span>
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-elevated">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-zinc-400 break-words">
                    {stat.title}
                  </p>
                  <p className="mt-1.5 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-zinc-100">
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 sm:p-3 ${stat.bg}`}>
                  <stat.icon
                    className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workforce Stats */}
      <WorkforceStatsGrid stats={workforceStats} />

      {/* ── Live Overview (full width — primary real-time widget) ── */}
      <LiveOverviewCard
        employees={uniqueLiveEmployees}
        title={t("widgets.liveOverview")}
        workingLabel={t("widgets.working")}
        breakLabel={t("widgets.onBreak")}
        clockedOutLabel={t("widgets.clockedOut")}
        sinceLabel={t("widgets.sinceTime")}
        emptyLabel={t("widgets.noOneOnline")}
      />

      {/* Favorites */}
      <FavoritesSection initialFavorites={favorites} />

      {/* Pending Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pendingItems")}</CardTitle>
        </CardHeader>
        <CardContent>
          {totalPending === 0 ? (
            <div className="flex items-center gap-3 py-2">
              <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 p-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-500">{t("noPending")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingItems.map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3.5 hover:border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2 ${item.bg}`}>
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {item.label}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
                    <span className="hidden sm:inline">{t("reviewNow")}</span>
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>{t("todayShifts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayShifts.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t("noShiftsToday")}</p>
          ) : (
            <div className="space-y-3">
              {(todayShifts as ShiftWithRelations[]).map((shift) => (
                <div
                  key={shift.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 dark:bg-zinc-800/50 p-4"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-sm"
                      style={{
                        backgroundColor: shift.employee.color || "#10b981",
                      }}
                    >
                      {shift.employee.firstName.charAt(0)}
                      {shift.employee.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {shift.employee.firstName} {shift.employee.lastName}
                      </p>
                      {shift.location && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {shift.location.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-sm sm:text-base text-gray-900">
                      {shift.startTime} - {shift.endTime}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      {statusLabel(shift.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Hours Chart ── */}
      <HoursChartCard
        weekData={weekChartData}
        monthData={monthChartData}
        yearData={yearChartData}
        dateRange={chartDateRange}
        title={t("widgets.totalRecordedHours")}
        avgLabelTemplate={t("widgets.avgPerDay", { hours: "{hours}" })}
        periodLabels={{
          week: t("widgets.week"),
          month: t("widgets.month"),
          year: t("widgets.year"),
        }}
        todayLabel={t("widgets.today")}
      />

      {/* ── Widget Grid: 2 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Overtime Tracker */}
        <OvertimeTrackerCard
          employees={overtimeEmployees}
          title={t("widgets.overtimeTracker")}
          totalLabel={t("widgets.totalOvertime")}
          hoursLabel={t("widgets.hrs")}
          emptyLabel={t("widgets.noOvertimeData")}
          emptyDesc={t("widgets.noOvertimeDataDesc")}
          overtimeLabel={t("widgets.overtime")}
          undertimeLabel={t("widgets.undertime")}
        />

        {/* Recent Activity */}
        <RecentActivityCard
          events={activityEvents}
          title={t("widgets.recentActivity")}
          emptyLabel={t("widgets.noRecentActivity")}
        />

        {/* Shift Coverage */}
        <ShiftCoverageCard
          days={coverageDays}
          title={t("widgets.shiftCoverage")}
          coverageLabel={t("widgets.coverage")}
          openShiftsLabel={t("widgets.openShifts")}
          fullCoverageLabel={t("widgets.fullCoverage")}
          viewPlanLabel={t("widgets.viewPlan")}
          emptyLabel={t("widgets.noShiftsPlanned")}
        />

        {/* Compliance Alerts */}
        <ComplianceAlertsCard
          alerts={complianceAlerts}
          title={t("widgets.complianceAlerts")}
          criticalLabel={t("widgets.critical")}
          warningLabel={t("widgets.warning")}
          allClearLabel={t("widgets.allCompliant")}
          allClearDesc={t("widgets.allCompliantDesc")}
          viewLabel={t("widgets.view")}
        />

        {/* Absenteeism */}
        <AbsenteeismCard
          employees={absentEmployees}
          title={t("widgets.absent")}
          todayLabel={t("widgets.today")}
          todayDate={berlinToday.toLocaleDateString(localeFmt)}
          daysRemainingLabel={(count) => t("widgets.daysRemaining", { count })}
          categoryLabel={categoryLabel}
          emptyLabel={t("widgets.noAbsences")}
          viewAllLabel={t("widgets.viewAll")}
          viewAllHref="/abwesenheiten"
        />

        {/* Pending Requests */}
        <PendingRequestsCard
          requests={pendingReqs}
          title={t("widgets.pendingRequests")}
          categoryLabel={categoryLabel}
          emptyLabel={t("widgets.noPendingRequests")}
          viewAllLabel={t("widgets.viewAll")}
          viewAllHref="/abwesenheiten"
        />

        {/* Location Distribution */}
        <LocationDistributionCard
          locations={locationGroups}
          title={t("widgets.whoIsWhere")}
          total={totalDistEmployees}
          emptyLabel={t("widgets.noData")}
        />

        {/* Live Projects */}
        <LiveProjectsCard
          projects={liveProjects}
          title={t("widgets.liveProjects")}
          emptyLabel={t("widgets.noActiveProjects")}
        />

        {/* Celebrations */}
        <CelebrationsCard
          entries={celebrations}
          title={t("widgets.celebrations")}
          birthdayLabel={t("widgets.birthday")}
          anniversaryLabel={t("widgets.anniversary")}
          todayLabel={t("widgets.today")}
          tomorrowLabel={t("widgets.tomorrow")}
          inDaysLabel={(count) => t("widgets.inDays", { count })}
          emptyLabel={t("widgets.noCelebrations")}
          emptyDesc={t("widgets.noCelebrationsDesc")}
        />
      </div>

      {/* Full-width: Team Calendar + Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TeamCalendarMiniCard
          days={calendarDays}
          title={t("widgets.teamCalendar")}
          monthLabel={monthLabelStr}
          dayLabels={calDayLabels}
          shiftsLabel={t("widgets.shifts")}
          absencesLabel={t("widgets.absences")}
        />
        <WeatherCard
          locations={weatherLocs}
          title={t("widgets.weather")}
          humidityLabel={t("widgets.humidity")}
          windLabel={t("widgets.wind")}
          emptyLabel={t("widgets.noLocations")}
          loadingLabel={t("widgets.loadingWeather")}
        />
      </div>
    </div>
  );
}
