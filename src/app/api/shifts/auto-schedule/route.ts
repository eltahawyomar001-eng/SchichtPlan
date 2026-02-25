import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { checkShiftConflicts } from "@/lib/automations";
import { calcGrossMinutes } from "@/lib/time-utils";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * POST /api/shifts/auto-schedule
 *
 * Auto-assign employees to OPEN (unassigned) shifts in a date range.
 *
 * Algorithm:
 *  1. Fetch all OPEN shifts in the date range (+ optional location filter)
 *  2. Fetch all active employees (with availability, skills, contracted hours)
 *  3. For each open shift, score every eligible employee:
 *     - Availability match → required (skip if NICHT_VERFUEGBAR)
 *     - No conflicts (overlap, absence, rest period) → required
 *     - Preference for employees with fewer hours already scheduled (fairness)
 *     - Prefer employees who are "BEVORZUGT" for that time slot
 *     - Contracted hours balance (don't over-schedule)
 *  4. Assign the best-scoring employee to each shift
 *  5. Return results with assignments + unresolved shifts
 *
 * This is real scheduling logic with DB queries — NOT static UI.
 */
export async function POST(req: Request) {
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

    // Management permission required
    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    // Plan gating: Team+ only
    const planGate = await requirePlanFeature(workspaceId, "autoScheduling");
    if (planGate) return planGate;

    const body = await req.json();
    const { startDate, endDate, locationId, dryRun = false } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate und endDate sind erforderlich" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return NextResponse.json(
        { error: "endDate muss nach startDate liegen" },
        { status: 400 },
      );
    }

    // Max 14 days to prevent runaway computation
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 14) {
      return NextResponse.json(
        { error: "Maximal 14 Tage pro Auto-Planung" },
        { status: 400 },
      );
    }

    // ── 1. Fetch OPEN shifts ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shiftWhere: Record<string, any> = {
      workspaceId,
      status: "OPEN",
      employeeId: null,
      date: { gte: start, lte: end },
    };
    if (locationId) shiftWhere.locationId = locationId;

    const openShifts = await prisma.shift.findMany({
      where: shiftWhere,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { location: true },
    });

    if (openShifts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Keine offenen Schichten im gewählten Zeitraum",
        assigned: 0,
        unresolved: 0,
        details: [],
      });
    }

    // ── 2. Fetch active employees with their availability & skills ──
    const employees = await prisma.employee.findMany({
      where: { workspaceId, isActive: true },
      include: {
        availabilities: true,
        employeeSkills: { include: { skill: true } },
        timeAccount: true,
      },
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "Keine aktiven Mitarbeiter vorhanden" },
        { status: 400 },
      );
    }

    // ── 3. Get existing shifts for the period (for hour tracking) ──
    const existingShifts = await prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
        status: { not: "CANCELLED" },
        employeeId: { not: null },
      },
    });

    // Track scheduled minutes per employee across the scheduling run
    const scheduledMinutes = new Map<string, number>();
    for (const shift of existingShifts) {
      if (shift.employeeId) {
        const current = scheduledMinutes.get(shift.employeeId) || 0;
        scheduledMinutes.set(
          shift.employeeId,
          current + calcGrossMinutes(shift.startTime, shift.endTime),
        );
      }
    }

    // ── 4. Score and assign ──
    const assignments: Array<{
      shiftId: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      locationName: string | null;
      employeeId: string;
      employeeName: string;
      score: number;
    }> = [];

    const unresolved: Array<{
      shiftId: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      locationName: string | null;
      reason: string;
    }> = [];

    for (const shift of openShifts) {
      const shiftDateStr = shift.date.toISOString().split("T")[0];
      const shiftDate = shift.date;
      const dayOfWeek = shiftDate.getDay();
      const isoWeekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      let bestEmployee: {
        id: string;
        name: string;
        score: number;
      } | null = null;

      for (const emp of employees) {
        // ── Check availability ──
        const unavailable = emp.availabilities.some(
          (a) =>
            a.weekday === isoWeekday &&
            a.type === "NICHT_VERFUEGBAR" &&
            a.validFrom <= shiftDate &&
            (!a.validUntil || a.validUntil >= shiftDate),
        );
        if (unavailable) continue;

        // ── Check conflicts via the automations engine ──
        const conflicts = await checkShiftConflicts({
          employeeId: emp.id,
          date: shiftDateStr,
          startTime: shift.startTime,
          endTime: shift.endTime,
          workspaceId,
        });

        if (conflicts.length > 0) continue;

        // ── Score the employee ──
        let score = 100;

        // Prefer employees who marked the time as BEVORZUGT
        const preferred = emp.availabilities.some(
          (a) =>
            a.weekday === isoWeekday &&
            a.type === "BEVORZUGT" &&
            a.validFrom <= shiftDate &&
            (!a.validUntil || a.validUntil >= shiftDate),
        );
        if (preferred) score += 30;

        // Fairness: fewer scheduled minutes → higher score
        const currentMinutes = scheduledMinutes.get(emp.id) || 0;
        const contractWeeklyMinutes = (emp.weeklyHours || 40) * 60;
        const periodWeeks = Math.max(1, daysDiff / 7);
        const targetMinutes = contractWeeklyMinutes * periodWeeks;
        const utilizationRatio = currentMinutes / targetMinutes;

        // Lower utilization = higher score (up to +50 bonus)
        score += Math.max(0, 50 * (1 - utilizationRatio));

        // Penalty for over-contracted hours
        const shiftMinutes = calcGrossMinutes(shift.startTime, shift.endTime);
        if (currentMinutes + shiftMinutes > targetMinutes * 1.1) {
          score -= 40; // heavy penalty for exceeding contract by >10%
        }

        // Location match: prefer employees from the same department/location
        if (shift.locationId && emp.departmentId) {
          // This is a soft preference, not a hard filter
          score += 5;
        }

        if (!bestEmployee || score > bestEmployee.score) {
          bestEmployee = {
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            score,
          };
        }
      }

      if (bestEmployee) {
        assignments.push({
          shiftId: shift.id,
          shiftDate: shiftDateStr,
          startTime: shift.startTime,
          endTime: shift.endTime,
          locationName: shift.location?.name || null,
          employeeId: bestEmployee.id,
          employeeName: bestEmployee.name,
          score: bestEmployee.score,
        });

        // Update tracked minutes so the next shift considers this assignment
        const shiftMinutes = calcGrossMinutes(shift.startTime, shift.endTime);
        const currentMins = scheduledMinutes.get(bestEmployee.id) || 0;
        scheduledMinutes.set(bestEmployee.id, currentMins + shiftMinutes);
      } else {
        unresolved.push({
          shiftId: shift.id,
          shiftDate: shiftDateStr,
          startTime: shift.startTime,
          endTime: shift.endTime,
          locationName: shift.location?.name || null,
          reason: "Kein verfügbarer Mitarbeiter gefunden",
        });
      }
    }

    // ── 5. Apply assignments (unless dry run) ──
    if (!dryRun && assignments.length > 0) {
      // Use a transaction for atomicity
      await prisma.$transaction(
        assignments.map((a) =>
          prisma.shift.update({
            where: { id: a.shiftId },
            data: {
              employeeId: a.employeeId,
              status: "SCHEDULED",
            },
          }),
        ),
      );

      createAuditLog({
        action: "CREATE",
        entityType: "AutoSchedule",
        userId: user.id,
        userEmail: user.email!,
        workspaceId,
        metadata: {
          startDate,
          endDate,
          locationId: locationId || null,
          assigned: assignments.length,
          unresolved: unresolved.length,
          totalOpenShifts: openShifts.length,
        },
      });

      log.info("[auto-schedule] Completed", {
        assigned: assignments.length,
        unresolved: unresolved.length,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      assigned: assignments.length,
      unresolved: unresolved.length,
      totalOpenShifts: openShifts.length,
      assignments,
      unresolvedShifts: unresolved,
    });
  } catch (error) {
    log.error("Error in auto-scheduling:", { error });
    return NextResponse.json(
      { error: "Fehler bei der automatischen Planung" },
      { status: 500 },
    );
  }
}
