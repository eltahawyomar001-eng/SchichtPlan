import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/**
 * GET /api/reports?start=2025-01-01&end=2025-01-31
 * Returns aggregated reporting data for the workspace.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Only management can view reports
    const forbidden = requirePermission(user, "employees", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    // Default: current month
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Fetch shifts in range
    const shifts = await prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
      },
      include: { employee: true },
    });

    // Fetch employees
    const employees = await prisma.employee.findMany({
      where: { workspaceId, isActive: true },
    });

    // ── Calculate metrics ──

    // Total shift hours
    let totalShiftHours = 0;
    const employeeHours: Record<
      string,
      { name: string; hours: number; shifts: number }
    > = {};

     
    let openShifts = 0;
    let nightShifts = 0;
    let holidayShifts = 0;
    let sundayShifts = 0;

    for (const shift of shifts) {
      const [sh, sm] = shift.startTime.split(":").map(Number);
      const [eh, em] = shift.endTime.split(":").map(Number);
      let hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
      if (hours < 0) hours += 24; // overnight

      totalShiftHours += hours;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = shift as any;
      if (!shift.employeeId) openShifts++;
      if (s.isNightShift) nightShifts++;
      if (s.isHolidayShift) holidayShifts++;
      if (s.isSundayShift) sundayShifts++;

      if (shift.employeeId) {
        if (!employeeHours[shift.employeeId]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const emp = (shift as any).employee;
          employeeHours[shift.employeeId] = {
            name: emp ? `${emp.firstName} ${emp.lastName}` : "Unbekannt",
            hours: 0,
            shifts: 0,
          };
        }
        employeeHours[shift.employeeId].hours += hours;
        employeeHours[shift.employeeId].shifts += 1;
      }
    }

    // Sort employees by hours (descending)
    const employeeStats = Object.entries(employeeHours)
      .map(([id, data]) => ({
        employeeId: id,
        ...data,
        hours: Math.round(data.hours * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours);

    // Absences in range
    const absences = await prisma.absenceRequest.findMany({
      where: {
        workspaceId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    const absencesByStatus = {
      pending: absences.filter((a) => a.status === "AUSSTEHEND").length,
      approved: absences.filter((a) => a.status === "GENEHMIGT").length,
      rejected: absences.filter((a) => a.status === "ABGELEHNT").length,
    };

    return NextResponse.json({
      period: {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
      summary: {
        totalShifts: shifts.length,
        totalShiftHours: Math.round(totalShiftHours * 100) / 100,
        openShifts,
        nightShifts,
        holidayShifts,
        sundayShifts,
        totalEmployees: employees.length,
        avgHoursPerEmployee:
          employees.length > 0
            ? Math.round((totalShiftHours / employees.length) * 100) / 100
            : 0,
      },
      absences: absencesByStatus,
      employeeStats,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Error generating report" },
      { status: 500 },
    );
  }
}
