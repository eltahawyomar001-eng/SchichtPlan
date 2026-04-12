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

export const revalidate = 0; // Always fresh data, but allows bfcache (no cache-control: no-store)

interface ShiftWithRelations {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  employee: { firstName: string; lastName: string; color: string | null };
  location: { name: string } | null;
}

/* ── Helper: Berlin "today" bounds ── */
function getTodayBounds() {
  const berlinDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Berlin",
  });
  return {
    todayStart: new Date(`${berlinDate}T00:00:00.000Z`),
    todayEnd: new Date(`${berlinDate}T23:59:59.999Z`),
  };
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

  // Guard: if no workspace yet (e.g. fresh OAuth sign-up), show setup prompt
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

  // Render Topbar immediately (LCP), stream data sections via Suspense
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
  const { todayStart, todayEnd } = getTodayBounds();

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
            date: { gte: todayStart, lt: todayEnd },
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
            date: { gt: todayEnd },
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
      {/* Employee Favorites */}
      <FavoritesSection initialFavorites={favorites} />

      {/* My Pending Requests */}
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
                      {t("pendingAbsences", {
                        count: myPendingAbsences,
                      })}
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

      {/* My Shifts Today */}
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

      {/* Upcoming Shifts */}
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
  const statusLabel = getStatusLabel(t);
  const { todayStart, todayEnd } = getTodayBounds();

  const [
    employeeCount,
    shiftCount,
    locationCount,
    todayShifts,
    pendingAbsences,
    pendingSwaps,
    pendingTimeEntries,
    currentUser,
  ] = await Promise.all([
    prisma.employee.count({ where: { workspaceId, isActive: true } }),
    prisma.shift.count({ where: { workspaceId } }),
    prisma.location.count({ where: { workspaceId } }),
    prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: todayStart, lt: todayEnd },
      },
      include: { employee: true, location: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.absenceRequest.count({
      where: { workspaceId, status: "AUSSTEHEND" },
    }),
    prisma.shiftSwapRequest.count({
      where: { workspaceId, status: "ANGEFRAGT" },
    }),
    prisma.timeEntry.count({
      where: { workspaceId, status: "EINGEREICHT" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardFavorites: true },
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
            {/* Progress bar */}
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
                    className={`flex-shrink-0 rounded-xl p-2.5 ${
                      step.done ? "bg-green-100" : step.bg
                    }`}
                  >
                    {step.done ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <step.icon className={`h-5 w-5 ${step.color}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium text-sm ${
                        step.done
                          ? "text-green-700 line-through"
                          : "text-gray-900"
                      }`}
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

      {/* Favorites — full-width */}
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
    </div>
  );
}
