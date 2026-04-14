import { prisma } from "@/lib/db";
import { isEmployee } from "@/lib/authorization";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { NextResponse } from "next/server";

/**
 * GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns everything needed for the monthly calendar view:
 * - shifts (with employee)
 * - approved absences (with employee)
 * - public holidays
 * - employees (for filter)
 * - departments (for filter)
 * - projects (for filter)
 */
export const GET = withRoute("/api/calendar", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start and end query params required" },
      { status: 400 },
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Build employee scope for EMPLOYEE role
  const empScope: Record<string, unknown> =
    isEmployee(user) && user.employeeId ? { employeeId: user.employeeId } : {};

  const [shifts, absences, publicHolidays, employees, departments, projects] =
    await Promise.all([
      // Shifts in range
      prisma.shift.findMany({
        where: {
          workspaceId,
          date: { gte: start, lte: end },
          status: { not: "CANCELLED" },
          ...empScope,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              color: true,
              departmentId: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),

      // Approved absences overlapping range
      prisma.absenceRequest.findMany({
        where: {
          workspaceId,
          status: "GENEHMIGT",
          startDate: { lte: end },
          endDate: { gte: start },
          ...empScope,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              color: true,
              departmentId: true,
            },
          },
        },
        orderBy: { startDate: "asc" },
      }),

      // Public holidays in range
      prisma.publicHoliday.findMany({
        where: {
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      }),

      // All active employees for filter
      prisma.employee.findMany({
        where: { workspaceId, isActive: true, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          color: true,
          departmentId: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),

      // Departments for filter
      prisma.department.findMany({
        where: { workspaceId },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),

      // Projects for filter
      prisma.project.findMany({
        where: { workspaceId, status: "AKTIV" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return NextResponse.json({
    shifts,
    absences,
    publicHolidays,
    employees,
    departments,
    projects,
  });
});
