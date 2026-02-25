import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireManagement } from "@/lib/authorization";
import { log } from "@/lib/logger";

// ─── GET /api/annual-planning?year=2026 ──────────────────────
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requireManagement(user);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
      10,
    );

    if (isNaN(year) || year < 2020 || year > 2040) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31`);

    // Fetch all active employees with their absences and vacation balances for this year
    const employees = await prisma.employee.findMany({
      where: {
        workspaceId: user.workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        color: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        absenceRequests: {
          where: {
            OR: [
              {
                startDate: { gte: yearStart, lte: yearEnd },
              },
              {
                endDate: { gte: yearStart, lte: yearEnd },
              },
              {
                startDate: { lte: yearStart },
                endDate: { gte: yearEnd },
              },
            ],
          },
          select: {
            id: true,
            category: true,
            startDate: true,
            endDate: true,
            halfDayStart: true,
            halfDayEnd: true,
            totalDays: true,
            status: true,
            reason: true,
          },
          orderBy: { startDate: "asc" },
        },
        vacationBalances: {
          where: { year },
          select: {
            id: true,
            year: true,
            totalEntitlement: true,
            carryOver: true,
            used: true,
            planned: true,
            remaining: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Build response with computed summary data
    const data = employees.map((emp) => {
      const balance = emp.vacationBalances[0] || null;
      const absences = emp.absenceRequests;

      // Compute per-category totals
      const approved = absences.filter((a) => a.status === "GENEHMIGT");
      const pending = absences.filter((a) => a.status === "AUSSTEHEND");

      const approvedVacationDays = approved
        .filter((a) => a.category === "URLAUB")
        .reduce((sum, a) => sum + a.totalDays, 0);
      const pendingVacationDays = pending
        .filter((a) => a.category === "URLAUB")
        .reduce((sum, a) => sum + a.totalDays, 0);
      const approvedOvertimeDays = approved
        .filter((a) => a.category === "SONDERURLAUB")
        .reduce((sum, a) => sum + a.totalDays, 0);
      const sickDays = approved
        .filter((a) => a.category === "KRANK")
        .reduce((sum, a) => sum + a.totalDays, 0);

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        color: emp.color,
        department: emp.department,
        absences,
        balance,
        summary: {
          totalEntitlement: balance?.totalEntitlement ?? 0,
          carryOver: balance?.carryOver ?? 0,
          used: balance?.used ?? 0,
          planned: balance?.planned ?? 0,
          remaining: balance?.remaining ?? 0,
          approvedVacationDays,
          pendingVacationDays,
          approvedOvertimeDays,
          sickDays,
        },
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    log.error("Error fetching annual planning:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
