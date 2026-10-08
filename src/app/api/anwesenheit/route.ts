import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import {
  breakInstants,
  classifyAttendance,
  summarise,
  type PlannedShift,
} from "@/lib/attendance-status";

/**
 * GET /api/anwesenheit — who is working right now, against the roster.
 *
 * Answers the four questions an admin actually has: who is on shift as
 * planned, who is on a break, who is not clocked in, and who is working
 * without or outside a planned shift. The last one is the only one that needs
 * a decision, so it carries the reason and the size of the deviation with it.
 */
export const GET = withRoute("/api/anwesenheit", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "time-entries", "read");
  if (forbidden) return forbidden;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // Yesterday too: a night shift started before midnight is still running, and
  // looking only at today would report every night worker as unplanned.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [employees, openEntries, shifts] = await Promise.all([
    prisma.employee.findMany({
      where: { workspaceId, deletedAt: null, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        color: true,
        position: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    // An open entry is one clocked in and not yet out. There is at most one
    // per employee, enforced by a partial unique index.
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        clockInAt: { not: null },
        clockOutAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        clockInAt: true,
        breakStart: true,
        breakEnd: true,
        date: true,
        unplannedDecision: true,
        unplannedReason: true,
      },
    }),
    prisma.shift.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: yesterday, lte: today },
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        startTime: true,
        endTime: true,
        location: { select: { name: true } },
      },
    }),
  ]);

  const entryByEmployee = new Map(openEntries.map((e) => [e.employeeId, e]));
  const shiftsByEmployee = new Map<string, PlannedShift[]>();
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const list = shiftsByEmployee.get(s.employeeId) ?? [];
    list.push({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      locationName: s.location?.name ?? null,
    });
    shiftsByEmployee.set(s.employeeId, list);
  }

  const rows = employees.map((emp) => {
    const entry = entryByEmployee.get(emp.id);
    const empShifts = shiftsByEmployee.get(emp.id) ?? [];
    const result = classifyAttendance({
      entry: entry?.clockInAt
        ? {
            id: entry.id,
            clockInAt: entry.clockInAt,
            // Anchored to the entry's own date: these are "HH:MM" strings.
            ...breakInstants(entry.date, entry.breakStart, entry.breakEnd),
          }
        : null,
      shifts: empShifts,
      now,
    });

    const matched = empShifts.find((s) => s.id === result.matchedShiftId);

    return {
      employeeId: emp.id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      position: emp.position,
      color: emp.color,
      status: result.status,
      reason: result.reason,
      deviationMinutes: result.deviationMinutes,
      entryId: entry?.id ?? null,
      entryDate: entry?.date ?? null,
      since: entry?.clockInAt ?? null,
      locationName: matched?.locationName ?? null,
      plannedStart: matched?.startTime ?? null,
      plannedEnd: matched?.endTime ?? null,
      // So the list can show what is still waiting on a manager.
      decision: entry?.unplannedDecision ?? null,
      decisionReason: entry?.unplannedReason ?? null,
    };
  });

  return NextResponse.json({
    now: now.toISOString(),
    summary: summarise(
      rows.map((r) => ({
        status: r.status,
        matchedShiftId: null,
        reason: null,
        deviationMinutes: null,
      })),
    ),
    employees: rows,
  });
});
