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
  PlusIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CalendarOffIcon,
  SwapIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

interface ShiftWithRelations {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  employee: { firstName: string; lastName: string; color: string | null };
  location: { name: string } | null;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const workspaceId = (session?.user as SessionUser)?.workspaceId;
  const t = await getTranslations("dashboard");
  const to = await getTranslations("onboarding");

  const [
    employeeCount,
    shiftCount,
    locationCount,
    todayShifts,
    pendingAbsences,
    pendingSwaps,
    pendingTimeEntries,
  ] = await Promise.all([
    prisma.employee.count({ where: { workspaceId, isActive: true } }),
    prisma.shift.count({ where: { workspaceId } }),
    prisma.location.count({ where: { workspaceId } }),
    prisma.shift.findMany({
      where: {
        workspaceId,
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
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
  ]);

  const stats = [
    {
      title: t("employees"),
      value: employeeCount,
      icon: UsersIcon,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: t("totalShifts"),
      value: shiftCount,
      icon: CalendarIcon,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: t("locations"),
      value: locationCount,
      icon: MapPinIcon,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: t("shiftsToday"),
      value: todayShifts.length,
      icon: ClockIcon,
      color: "text-amber-600",
      bg: "bg-amber-50",
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
      bg: "bg-emerald-50",
    },
    {
      title: to("step2Title"),
      desc: to("step2Desc"),
      done: employeeCount > 0,
      href: "/mitarbeiter",
      icon: UsersIcon,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: to("step3Title"),
      desc: to("step3Desc"),
      done: shiftCount > 0,
      href: "/schichtplan",
      icon: CalendarIcon,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  const totalPending = pendingAbsences + pendingSwaps + pendingTimeEntries;

  const pendingItems = [
    {
      count: pendingAbsences,
      label: t("pendingAbsences", { count: pendingAbsences }),
      href: "/abwesenheiten",
      icon: CalendarOffIcon,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      count: pendingSwaps,
      label: t("pendingSwaps", { count: pendingSwaps }),
      href: "/schichttausch",
      icon: SwapIcon,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      count: pendingTimeEntries,
      label: t("pendingTimeEntries", { count: pendingTimeEntries }),
      href: "/zeiterfassung",
      icon: ClockIcon,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ].filter((item) => item.count > 0);

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Onboarding Wizard */}
        {showOnboarding && (
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50/60 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg sm:text-xl">
                🚀 {to("welcomeTitle")}
              </CardTitle>
              <p className="text-sm text-gray-500">{to("welcomeSubtitle")}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {onboardingSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 sm:gap-4 rounded-xl border p-3 sm:p-4 transition-all ${
                      step.done
                        ? "border-green-200 bg-green-50/50"
                        : "border-gray-200 bg-white hover:border-violet-300 hover:shadow-sm"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 rounded-lg p-2 sm:p-2.5 ${
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
                      <p className="text-xs text-gray-500 mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                    {step.done ? (
                      <span className="text-xs font-medium text-green-600 flex-shrink-0">
                        {to("completed")} ✓
                      </span>
                    ) : (
                      <Link
                        href={step.href}
                        className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 flex-shrink-0"
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
            <Card key={stat.title}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">
                      {stat.title}
                    </p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`rounded-lg p-2 sm:p-3 ${stat.bg}`}>
                    <stat.icon
                      className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions + Pending Items row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("quickActions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <Link
                  href="/mitarbeiter"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:border-violet-300 hover:bg-violet-50/50 transition-all group"
                >
                  <div className="rounded-lg bg-violet-50 p-2 group-hover:bg-violet-100 transition-colors">
                    <PlusIcon className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">
                    {t("addEmployee")}
                  </span>
                </Link>
                <Link
                  href="/standorte"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
                >
                  <div className="rounded-lg bg-emerald-50 p-2 group-hover:bg-emerald-100 transition-colors">
                    <PlusIcon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">
                    {t("addLocation")}
                  </span>
                </Link>
                <Link
                  href="/schichtplan"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="rounded-lg bg-blue-50 p-2 group-hover:bg-blue-100 transition-colors">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    {t("createShift")}
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Pending Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("pendingItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              {totalPending === 0 ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="rounded-lg bg-green-50 p-2">
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 hover:border-gray-300 hover:bg-gray-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${item.bg}`}>
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {item.label}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-violet-600 group-hover:text-violet-700 flex items-center gap-1">
                        <span className="hidden sm:inline">
                          {t("reviewNow")}
                        </span>
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Shifts */}
        <Card>
          <CardHeader>
            <CardTitle>{t("todayShifts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {todayShifts.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noShiftsToday")}</p>
            ) : (
              <div className="space-y-3">
                {(todayShifts as ShiftWithRelations[]).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 sm:p-4"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0"
                        style={{
                          backgroundColor: shift.employee.color || "#3B82F6",
                        }}
                      >
                        {shift.employee.firstName.charAt(0)}
                        {shift.employee.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {shift.employee.firstName} {shift.employee.lastName}
                        </p>
                        {shift.location && (
                          <p className="text-sm text-gray-500">
                            {shift.location.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-medium text-sm sm:text-base text-gray-900">
                        {shift.startTime} - {shift.endTime}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {shift.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
