import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError } from "@/lib/api-response";

/* ─── Types ───────────────────────────────────────────────── */

interface RiskFactor {
  key: string;
  label: string;
  value: number;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
}

interface EmployeeWellness {
  employeeId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  departmentName: string | null;
  score: number; // 0-100, higher = better
  level: "excellent" | "good" | "caution" | "warning" | "critical";
  riskFactors: RiskFactor[];
  shiftsInPeriod: number;
  hoursInPeriod: number;
}

/* ─── Helpers ─────────────────────────────────────────────── */

/** Parse "HH:MM" to total minutes from midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Duration in hours between two HH:MM strings, handling overnight. */
function shiftHours(start: string, end: string): number {
  const s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e <= s) e += 24 * 60; // overnight
  return (e - s) / 60;
}

/** Rest hours between two consecutive shifts. */
function restHoursBetween(
  prevEnd: string,
  prevDate: Date,
  nextStart: string,
  nextDate: Date,
): number {
  const prevEndMin = timeToMinutes(prevEnd);
  let prevEndDate = new Date(prevDate);
  // If overnight shift, end is actually the next day
  if (timeToMinutes(prevEnd) <= timeToMinutes("06:00")) {
    prevEndDate = new Date(prevDate);
    prevEndDate.setDate(prevEndDate.getDate() + 1);
  }
  prevEndDate.setHours(Math.floor(prevEndMin / 60), prevEndMin % 60, 0, 0);

  const nextStartMin = timeToMinutes(nextStart);
  const nextStartDate = new Date(nextDate);
  nextStartDate.setHours(
    Math.floor(nextStartMin / 60),
    nextStartMin % 60,
    0,
    0,
  );

  return (nextStartDate.getTime() - prevEndDate.getTime()) / (1000 * 60 * 60);
}

/**
 * GET /api/reports/wellness
 *
 * Returns a fatigue / wellness score for every active employee based on
 * their shift patterns over the last 30 days.
 *
 * Risk factors analysed:
 * 1. Consecutive working days (>5 = caution, >7 = warning)
 * 2. Night shifts per month (>6 = caution, >10 = warning)
 * 3. Weekly overtime hours (compared to contracted weeklyHours)
 * 4. Short rest periods (<11 h between shifts — ArbZG violation)
 * 5. Weekend days worked per month (>4 = caution, >6 = warning)
 * 6. Total hours per month (>200 = warning, >220 = critical)
 *
 * Each factor contributes a penalty to a base score of 100.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "reports", "read");
    if (forbidden) return forbidden;

    // Optional date range (default: last 30 days)
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get("days")) || 30;
    const days = Math.min(Math.max(daysParam, 7), 90);

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    // Fetch all active employees with department
    const employees = await prisma.employee.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        weeklyHours: true,
        workDaysPerWeek: true,
        department: { select: { name: true } },
      },
    });

    // Fetch all shifts in the period
    const shifts = await prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: now },
        status: { not: "CANCELLED" },
        employeeId: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        employeeId: true,
      },
      orderBy: { date: "asc" },
    });

    // Group shifts by employee
    const shiftsByEmployee = new Map<string, typeof shifts>();
    for (const s of shifts) {
      if (!s.employeeId) continue;
      const arr = shiftsByEmployee.get(s.employeeId) || [];
      arr.push(s);
      shiftsByEmployee.set(s.employeeId, arr);
    }

    // Calculate wellness score per employee
    const results: EmployeeWellness[] = [];

    for (const emp of employees) {
      const empShifts = shiftsByEmployee.get(emp.id) || [];
      const riskFactors: RiskFactor[] = [];

      if (empShifts.length === 0) {
        results.push({
          employeeId: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          position: emp.position,
          departmentName: emp.department?.name || null,
          score: 100,
          level: "excellent",
          riskFactors: [],
          shiftsInPeriod: 0,
          hoursInPeriod: 0,
        });
        continue;
      }

      // ── 1. Consecutive working days ──
      const workDates = [
        ...new Set(
          empShifts.map((s) => new Date(s.date).toISOString().slice(0, 10)),
        ),
      ].sort();
      let maxConsecutive = 1;
      let current = 1;
      for (let i = 1; i < workDates.length; i++) {
        const prev = new Date(workDates[i - 1]);
        const curr = new Date(workDates[i]);
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / 86400000,
        );
        if (diffDays === 1) {
          current++;
          maxConsecutive = Math.max(maxConsecutive, current);
        } else {
          current = 1;
        }
      }

      let consecutiveSeverity: RiskFactor["severity"] = "low";
      if (maxConsecutive >= 10) consecutiveSeverity = "critical";
      else if (maxConsecutive >= 7) consecutiveSeverity = "high";
      else if (maxConsecutive >= 5) consecutiveSeverity = "medium";

      riskFactors.push({
        key: "consecutiveDays",
        label: "Aufeinanderfolgende Arbeitstage",
        value: maxConsecutive,
        threshold: 5,
        severity: consecutiveSeverity,
      });

      // ── 2. Night shifts (start time 22:00–05:59) ──
      const nightCount = empShifts.filter((s) => {
        const hour = timeToMinutes(s.startTime) / 60;
        return hour >= 22 || hour < 6;
      }).length;
      let nightSeverity: RiskFactor["severity"] = "low";
      if (nightCount >= 10) nightSeverity = "critical";
      else if (nightCount >= 8) nightSeverity = "high";
      else if (nightCount >= 6) nightSeverity = "medium";

      riskFactors.push({
        key: "nightShifts",
        label: "Nachtschichten",
        value: nightCount,
        threshold: 6,
        severity: nightSeverity,
      });

      // ── 3. Total hours & overtime ──
      let totalHours = 0;
      for (const s of empShifts) {
        totalHours += shiftHours(s.startTime, s.endTime);
      }
      totalHours = Math.round(totalHours * 10) / 10;

      const contractWeekly = emp.weeklyHours || 40;
      const expectedHours = (contractWeekly / 7) * days;
      const overtime = Math.max(0, totalHours - expectedHours);
      const overtimePercent =
        expectedHours > 0 ? (overtime / expectedHours) * 100 : 0;

      let overtimeSeverity: RiskFactor["severity"] = "low";
      if (overtimePercent >= 30) overtimeSeverity = "critical";
      else if (overtimePercent >= 20) overtimeSeverity = "high";
      else if (overtimePercent >= 10) overtimeSeverity = "medium";

      riskFactors.push({
        key: "overtime",
        label: "Überstunden",
        value: Math.round(overtime * 10) / 10,
        threshold: Math.round(expectedHours * 0.1),
        severity: overtimeSeverity,
      });

      // ── 4. Short rest periods (<11h — ArbZG §5) ──
      const sorted = [...empShifts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      let shortRestCount = 0;
      let shortestRest = Infinity;
      for (let i = 1; i < sorted.length; i++) {
        const rest = restHoursBetween(
          sorted[i - 1].endTime,
          new Date(sorted[i - 1].date),
          sorted[i].startTime,
          new Date(sorted[i].date),
        );
        if (rest >= 0 && rest < 11) {
          shortRestCount++;
          shortestRest = Math.min(shortestRest, rest);
        }
      }

      let restSeverity: RiskFactor["severity"] = "low";
      if (shortRestCount >= 6) restSeverity = "critical";
      else if (shortRestCount >= 3) restSeverity = "high";
      else if (shortRestCount >= 1) restSeverity = "medium";

      riskFactors.push({
        key: "shortRest",
        label: "Kurzruhezeiten (<11h)",
        value: shortRestCount,
        threshold: 1,
        severity: restSeverity,
      });

      // ── 5. Weekend days worked ──
      const weekendDays = empShifts.filter((s) => {
        const day = new Date(s.date).getDay();
        return day === 0 || day === 6; // Sat or Sun
      }).length;

      let weekendSeverity: RiskFactor["severity"] = "low";
      if (weekendDays >= 8) weekendSeverity = "critical";
      else if (weekendDays >= 6) weekendSeverity = "high";
      else if (weekendDays >= 4) weekendSeverity = "medium";

      riskFactors.push({
        key: "weekendWork",
        label: "Wochenendarbeit",
        value: weekendDays,
        threshold: 4,
        severity: weekendSeverity,
      });

      // ── 6. Total monthly hours ──
      const monthlyHoursScaled = totalHours * (30 / days); // normalise to 30d
      let hoursSeverity: RiskFactor["severity"] = "low";
      if (monthlyHoursScaled >= 220) hoursSeverity = "critical";
      else if (monthlyHoursScaled >= 200) hoursSeverity = "high";
      else if (monthlyHoursScaled >= 180) hoursSeverity = "medium";

      riskFactors.push({
        key: "totalHours",
        label: "Monatsstunden (hochgerechnet)",
        value: Math.round(monthlyHoursScaled),
        threshold: 180,
        severity: hoursSeverity,
      });

      // ── Composite score (100 = perfect, 0 = critical) ──
      const penalties: Record<RiskFactor["severity"], number> = {
        low: 0,
        medium: 8,
        high: 18,
        critical: 28,
      };
      const totalPenalty = riskFactors.reduce(
        (sum, f) => sum + penalties[f.severity],
        0,
      );
      const score = Math.max(0, Math.min(100, 100 - totalPenalty));

      let level: EmployeeWellness["level"] = "excellent";
      if (score < 30) level = "critical";
      else if (score < 50) level = "warning";
      else if (score < 70) level = "caution";
      else if (score < 85) level = "good";

      results.push({
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        position: emp.position,
        departmentName: emp.department?.name || null,
        score,
        level,
        riskFactors,
        shiftsInPeriod: empShifts.length,
        hoursInPeriod: totalHours,
      });
    }

    // Sort: worst score first
    results.sort((a, b) => a.score - b.score);

    // Summary stats
    const summary = {
      totalEmployees: results.length,
      averageScore: Math.round(
        results.reduce((s, r) => s + r.score, 0) / (results.length || 1),
      ),
      critical: results.filter((r) => r.level === "critical").length,
      warning: results.filter((r) => r.level === "warning").length,
      caution: results.filter((r) => r.level === "caution").length,
      good: results.filter((r) => r.level === "good").length,
      excellent: results.filter((r) => r.level === "excellent").length,
      period: { start: start.toISOString(), end: now.toISOString(), days },
    };

    log.info("Wellness report generated", {
      workspaceId,
      userId: user.id,
      employeeCount: results.length,
      avgScore: summary.averageScore,
    });

    return Response.json({ summary, employees: results });
  } catch (error) {
    log.error("Error generating wellness report:", { error });
    captureRouteError(error, {
      route: "/api/reports/wellness",
      method: "GET",
    });
    return serverError();
  }
}
