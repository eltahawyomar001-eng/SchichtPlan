import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  checkShiftConflicts,
  createRecurringShifts,
  createSystemNotification,
} from "@/lib/automations";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
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
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

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

    if (!date || !startTime || !endTime || !employeeId) {
      return NextResponse.json(
        { error: "Datum, Start-/Endzeit und Mitarbeiter sind erforderlich." },
        { status: 400 },
      );
    }

    // ── Automation: Conflict detection ──
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
          error: "Konflikte erkannt",
          conflicts,
        },
        { status: 409 },
      );
    }

    // ── Create the shift ──
    const shift = await prisma.shift.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        notes: notes || null,
        employeeId,
        locationId: locationId || null,
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
    const employeeName = `${shift.employee.firstName} ${shift.employee.lastName}`;
    console.log(
      `[shifts/POST] Shift created for ${employeeName}, email=${shift.employee.email ?? "NONE"}, phone=${shift.employee.phone ?? "NONE"}`,
    );
    if (shift.employee.email) {
      await createSystemNotification({
        type: "SHIFT_ASSIGNED",
        title: "Neue Schicht zugewiesen",
        message: `Ihnen wurde eine Schicht am ${new Date(date).toLocaleDateString("de-DE")} (${startTime}–${endTime}) zugewiesen.`,
        link: "/schichtplan",
        workspaceId,
        recipientType: "employee",
        employeeEmail: shift.employee.email,
      });
    } else {
      console.warn(
        `[shifts/POST] Employee ${employeeName} has no email — notification skipped entirely`,
      );
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
