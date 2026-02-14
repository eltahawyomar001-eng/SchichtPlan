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
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

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

  const [employeeCount, shiftCount, locationCount, todayShifts] =
    await Promise.all([
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
    ]);

  const stats = [
    {
      title: "Mitarbeiter",
      value: employeeCount,
      icon: UsersIcon,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "Schichten gesamt",
      value: shiftCount,
      icon: CalendarIcon,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Standorte",
      value: locationCount,
      icon: MapPinIcon,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Schichten heute",
      value: todayShifts.length,
      icon: ClockIcon,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div>
      <Topbar
        title="Dashboard"
        description="Übersicht über Ihre Schichtplanung"
      />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {stat.title}
                    </p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Today's Shifts */}
        <Card>
          <CardHeader>
            <CardTitle>Heutige Schichten</CardTitle>
          </CardHeader>
          <CardContent>
            {todayShifts.length === 0 ? (
              <p className="text-sm text-gray-500">
                Keine Schichten für heute geplant.
              </p>
            ) : (
              <div className="space-y-3">
                {(todayShifts as ShiftWithRelations[]).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
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
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {shift.startTime} - {shift.endTime}
                      </p>
                      <p className="text-sm text-gray-500">{shift.status}</p>
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
