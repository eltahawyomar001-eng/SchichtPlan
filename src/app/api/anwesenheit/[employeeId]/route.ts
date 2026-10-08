import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import {
  breakInstants,
  classifyAttendance,
  type PlannedShift,
} from "@/lib/attendance-status";

/**
 * GET /api/anwesenheit/[employeeId]?date=YYYY-MM-DD
 *
 * One employee, one day: the times actually recorded alongside the shifts they
 * were rostered for. This is the view an admin opens after seeing someone
 * flagged as unplanned, so the two have to sit next to each other -- the
 * decision is "does this recorded time belong against that plan", and it
 * cannot be made from either half alone.
 */
export const GET = withRoute(
  "/api/anwesenheit/[employeeId]",
  "GET",
  async (req, context) => {
    const { employeeId } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "time-entries", "read");
    if (forbidden) return forbidden;

    const dateParam = new URL(req.url).searchParams.get("date");
    const day = dateParam ? new Date(dateParam) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const prev = new Date(day);
    prev.setDate(prev.getDate() - 1);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, workspaceId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, position: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [entries, shifts] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          workspaceId,
          employeeId,
          deletedAt: null,
          date: { gte: day, lt: next },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          breakMinutes: true,
          netMinutes: true,
          status: true,
          remarks: true,
          clockInAt: true,
          clockOutAt: true,
          breakStart: true,
          breakEnd: true,
          unplannedDecision: true,
          unplannedReason: true,
          unplannedDecidedBy: true,
          unplannedDecidedAt: true,
          location: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      // Yesterday as well, so a night shift that began before midnight is
      // still available to match against.
      prisma.shift.findMany({
        where: {
          workspaceId,
          employeeId,
          deletedAt: null,
          date: { gte: prev, lt: next },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          breakMinutes: true,
          location: { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const planned: PlannedShift[] = shifts.map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      locationName: s.location?.name ?? null,
    }));

    const now = new Date();
    const rows = entries.map((e) => {
      const verdict = e.clockInAt
        ? classifyAttendance({
            entry: {
              id: e.id,
              clockInAt: e.clockInAt,
              ...breakInstants(e.date, e.breakStart, e.breakEnd),
            },
            shifts: planned,
            // For a finished entry, judge it as at clock-out rather than now,
            // or every past entry eventually looks like an overrun.
            now: e.clockOutAt ?? now,
          })
        : null;
      return { ...e, verdict };
    });

    return NextResponse.json({
      employee,
      date: day.toISOString().slice(0, 10),
      entries: rows,
      shifts: shifts.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        locationName: s.location?.name ?? null,
      })),
    });
  },
);
