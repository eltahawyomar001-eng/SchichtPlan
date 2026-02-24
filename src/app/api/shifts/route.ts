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
  executeCustomRules,
} from "@/lib/automations";
import {
  isPublicHoliday,
  isSunday,
  isNightShift,
  calculateSurcharge,
} from "@/lib/holidays";
import { createShiftSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

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

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const where: {
      workspaceId: string;
      date?: { gte: Date; lte: Date };
      employeeId?: string;
    } = {
      workspaceId,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // EMPLOYEE can only see their own shifts
    if (isEmployee(user) && user.employeeId) {
      where.employeeId = user.employeeId;
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
    log.error("Error fetching shifts:", { error: error });
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
    const parsed = validateBody(createShiftSchema, body);
    if (!parsed.success) return parsed.response;
    const {
      date,
      startTime,
      endTime,
      employeeId,
      locationId,
      notes,
      repeatWeeks,
    } = parsed.data;

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
        baseShift: {
          date,
          startTime,
          endTime,
          employeeId: employeeId ?? "",
          locationId: locationId || null,
          notes: notes || null,
        },
        repeatWeeks: Math.min(repeatWeeks, 52),
        workspaceId,
      });
    }

    // ── Automation: Notify employee about new shift ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shiftAny = shift as any;
    if (shiftAny.employee) {
      const employeeName = `${shiftAny.employee.firstName} ${shiftAny.employee.lastName}`;
      log.info(
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
        log.warn(
          `[shifts/POST] Employee ${employeeName} has no email — notification skipped entirely`,
        );
      }
    } else {
      log.info(`[shifts/POST] Open shift created (no employee assigned)`);
    }

    // ── Automation: Execute custom rules ──
    const shiftContext = {
      id: shift.id,
      date,
      startTime,
      endTime,
      employeeId: employeeId || "",
      employeeEmail: shiftAny?.employee?.email || "",
      status: shift.status,
      surchargePercent: surcharge,
      isNightShift: nightCheck,
      isSundayShift: sundayCheck,
      isHolidayShift: holidayCheck.isHoliday,
    };
    executeCustomRules("shift.created", workspaceId, shiftContext).catch(
      (err) => log.error("Custom rule execution error:", { error: err }),
    );

    return NextResponse.json(
      { ...shift, recurring: recurringResult },
      { status: 201 },
    );
  } catch (error) {
    log.error("Error creating shift:", { error: error });
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
