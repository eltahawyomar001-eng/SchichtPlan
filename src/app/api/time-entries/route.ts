import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  validateTimeEntry,
  calcGrossMinutes,
  calcBreakMinutes,
  calcNetMinutes,
} from "@/lib/time-utils";
import { ensureLegalBreak } from "@/lib/automations";

// ─── GET  /api/time-entries ─────────────────────────────────────
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { workspaceId };

    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    // Employees can only see their own entries
    if (user.role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({
        where: { workspaceId, email: user.email ?? undefined },
      });
      if (employee) where.employeeId = employee.id;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        employee: true,
        location: true,
        auditLog: { orderBy: { performedAt: "desc" }, take: 5 },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// ─── POST  /api/time-entries ────────────────────────────────────
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const body = await req.json();

    // Validate
    const errors = validateTimeEntry(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Overlap check
    const existingEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId: body.employeeId,
        date: new Date(body.date),
        status: { not: "ZURUECKGEWIESEN" },
      },
    });

    const newStart = body.startTime;
    const newEnd = body.endTime;
    for (const entry of existingEntries) {
      if (timesOverlap(entry.startTime, entry.endTime, newStart, newEnd)) {
        return NextResponse.json(
          { error: "Überlappung mit bestehendem Eintrag" },
          { status: 409 },
        );
      }
    }

    // Calculate durations
    const grossMinutes = calcGrossMinutes(body.startTime, body.endTime);
    const rawBreakMins = calcBreakMinutes(
      body.breakStart,
      body.breakEnd,
      body.breakMinutes,
    );
    // ── Automation: Ensure ArbZG minimum break ──
    const breakMins = ensureLegalBreak(grossMinutes, rawBreakMins);
    const netMinutes = calcNetMinutes(grossMinutes, breakMins);

    const entry = await prisma.timeEntry.create({
      data: {
        date: new Date(body.date),
        startTime: body.startTime,
        endTime: body.endTime,
        breakStart: body.breakStart || null,
        breakEnd: body.breakEnd || null,
        breakMinutes: breakMins,
        grossMinutes,
        netMinutes,
        remarks: body.remarks || null,
        employeeId: body.employeeId,
        locationId: body.locationId || null,
        shiftId: body.shiftId || null,
        workspaceId,
      },
      include: { employee: true, location: true },
    });

    // Create audit log entry
    await prisma.timeEntryAudit.create({
      data: {
        action: "CREATED",
        performedBy: user.id,
        timeEntryId: entry.id,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating time entry:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen" },
      { status: 500 },
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const a0 = toMin(aStart);
  let a1 = toMin(aEnd);
  if (a1 <= a0) a1 += 1440;
  const b0 = toMin(bStart);
  let b1 = toMin(bEnd);
  if (b1 <= b0) b1 += 1440;
  return a0 < b1 && b0 < a1;
}
