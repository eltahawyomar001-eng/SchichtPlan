import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import {
  checkShiftConflicts,
  createRecurringShifts,
  createSystemNotification,
} from "@/lib/automations";
import {
  isPublicHoliday,
  isSunday,
  isNightShift,
  calculateSurcharge,
} from "@/lib/holidays";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const where: { workspaceId: string; date?: { gte: Date; lte: Date } } = {
      workspaceId,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        employee: true,
        location: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

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

    // Only OWNER, ADMIN, MANAGER can create shifts
    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const {
      date,
      startTime,
      endTime,
      employeeId,
      locationId,
      notes,
      repeatWeeks,
    } = body;

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        {
          error: "Date, start time and end time are required",
        },
        { status: 400 },
      );
    }

    // ── Automation: Conflict detection (only if assigned) ──
    if (employeeId) {
      const conflicts = await checkShiftConflicts({
        employeeId,
        date,
        startTime,
        endTime,
        workspaceId,
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: "Conflicts detected",
            conflicts,
          },
          { status: 409 },
        );
      }
    }

    // ── Auto-detect surcharges ──
    const shiftDate = new Date(date);

    // Get workspace Bundesland for holiday check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = await (prisma as any).workspace?.findUnique?.({
      where: { id: workspaceId },
      select: { bundesland: true },
    });
    const bundesland = ws?.bundesland || "HE";

    const holidayCheck = isPublicHoliday(shiftDate, bundesland);
    const sundayCheck = isSunday(shiftDate);
    const nightCheck = isNightShift(startTime, endTime);
    const surcharge = calculateSurcharge({
      isNight: nightCheck,
      isSunday: sundayCheck,
      isHoliday: holidayCheck.isHoliday,
    });

    // ── Create the shift ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shift = await (prisma.shift.create as any)({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        notes: notes || null,
        status: employeeId ? "SCHEDULED" : "OPEN",
        employeeId: employeeId || null,
        locationId: locationId || null,
        isNightShift: nightCheck,
        isHolidayShift: holidayCheck.isHoliday,
        isSundayShift: sundayCheck,
        surchargePercent: surcharge,
        workspaceId,
      },
      include: {
        employee: true,
        location: true,
      },
    });

    // ── Automation: Recurring shifts ──
    let recurringResult = null;
    if (repeatWeeks && repeatWeeks > 0) {
      recurringResult = await createRecurringShifts({
        baseShift: { date, startTime, endTime, employeeId, locationId, notes },
        repeatWeeks: Math.min(repeatWeeks, 52),
        workspaceId,
      });
    }

    // ── Automation: Notify employee about new shift ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shiftAny = shift as any;
    if (shiftAny.employee) {
      const employeeName = `${shiftAny.employee.firstName} ${shiftAny.employee.lastName}`;
      console.log(
        `[shifts/POST] Shift created for ${employeeName}, email=${shiftAny.employee.email ?? "NONE"}, phone=${shiftAny.employee.phone ?? "NONE"}`,
      );
      if (shiftAny.employee.email) {
        await createSystemNotification({
          type: "SHIFT_ASSIGNED",
          title: "Neue Schicht zugewiesen",
          message: `Ihnen wurde eine Schicht am ${new Date(date).toLocaleDateString("de-DE")} (${startTime}–${endTime}) zugewiesen.`,
          link: "/schichtplan",
          workspaceId,
          recipientType: "employee",
          employeeEmail: shiftAny.employee.email,
        });
      } else {
        console.warn(
          `[shifts/POST] Employee ${employeeName} has no email — notification skipped entirely`,
        );
      }
    } else {
      console.log(`[shifts/POST] Open shift created (no employee assigned)`);
    }

    return NextResponse.json(
      { ...shift, recurring: recurringResult },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating shift:", error);
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
