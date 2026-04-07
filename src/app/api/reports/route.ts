import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/reports?start=2025-01-01&end=2025-01-31
 * Returns aggregated reporting data for the workspace.
 */
export const GET = withRoute("/api/reports", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Only management can view reports
  const forbidden = requirePermission(user, "reports", "read");
  if (forbidden) return forbidden;

  // Check plan feature
  const planGate = await requirePlanFeature(workspaceId, "analytics");
  if (planGate) return planGate;

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

  // ── Absence breakdown by category ──
  const absencesByCategory: Record<string, number> = {};
  for (const absence of absences) {
    const cat = absence.category || "SONSTIG";
    absencesByCategory[cat] = (absencesByCategory[cat] || 0) + 1;
  }

  // ── Time entries in range ──
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      workspaceId,
      date: { gte: start, lte: end },
    },
    include: { employee: true },
  });

  let totalTrackedMinutes = 0;
  let totalBreakMinutes = 0;
  let liveClockEntries = 0;
  const statusCounts: Record<string, number> = {};
  const employeeTracked: Record<
    string,
    { name: string; minutes: number; entries: number }
  > = {};

  for (const entry of timeEntries) {
    totalTrackedMinutes += entry.netMinutes;
    totalBreakMinutes += entry.breakMinutes;
    if (entry.isLiveClock) liveClockEntries++;

    const status = entry.status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (entry.employeeId) {
      if (!employeeTracked[entry.employeeId]) {
        const emp = entry.employee;
        employeeTracked[entry.employeeId] = {
          name: emp ? `${emp.firstName} ${emp.lastName}` : "Unbekannt",
          minutes: 0,
          entries: 0,
        };
      }
      employeeTracked[entry.employeeId].minutes += entry.netMinutes;
      employeeTracked[entry.employeeId].entries += 1;
    }
  }

  const employeeTimeStats = Object.entries(employeeTracked)
    .map(([id, data]) => ({
      employeeId: id,
      name: data.name,
      hours: Math.round((data.minutes / 60) * 100) / 100,
      entries: data.entries,
    }))
    .sort((a, b) => b.hours - a.hours);

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
    timeTracking: {
      totalEntries: timeEntries.length,
      totalTrackedHours: Math.round((totalTrackedMinutes / 60) * 100) / 100,
      totalBreakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
      liveClockEntries,
      byStatus: statusCounts,
    },
    absences: absencesByStatus,
    absencesByCategory,
    employeeStats,
    employeeTimeStats,
  });
});
