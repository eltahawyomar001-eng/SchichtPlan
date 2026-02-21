import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import ical, { ICalCalendarMethod } from "ical-generator";

/**
 * GET /api/ical
 * Returns an .ics feed of the user's shifts.
 * Query params: start, end (optional date filters)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const employeeId = user.employeeId;
    const workspaceId = user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: Record<string, unknown> = { workspaceId };
    if (employeeId) where.employeeId = employeeId;
    if (start && end) {
      where.date = { gte: new Date(start), lte: new Date(end) };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { employee: true, location: true },
      orderBy: { date: "asc" },
    });

    const cal = ical({
      name: "SchichtPlan",
      method: ICalCalendarMethod.PUBLISH,
    });

    for (const shift of shifts) {
      const dateStr = shift.date.toISOString().split("T")[0];
      const startDt = new Date(`${dateStr}T${shift.startTime}:00`);

      // Handle overnight shifts
      let endDt = new Date(`${dateStr}T${shift.endTime}:00`);
      if (endDt <= startDt) {
        endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
      }

      cal.createEvent({
        start: startDt,
        end: endDt,
        summary: shift.employee
          ? `${shift.employee.firstName} ${shift.employee.lastName}`
          : "Offene Schicht",
        location: shift.location?.name || undefined,
        description: shift.notes || undefined,
      });
    }

    return new Response(cal.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=schichtplan.ics",
      },
    });
  } catch (error) {
    console.error("iCal error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
