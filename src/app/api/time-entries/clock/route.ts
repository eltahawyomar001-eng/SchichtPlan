import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureLegalBreak } from "@/lib/automations";
import type { SessionUser } from "@/lib/types";

/**
 * POST /api/time-entries/clock
 * Live punch-clock: clock-in, clock-out, break-start, break-end with optional GPS.
 *
 * Body: { action: "in" | "out" | "break-start" | "break-end", lat?: number, lng?: number }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const employeeId = user.employeeId;
    const workspaceId = user.workspaceId;

    if (!employeeId || !workspaceId) {
      return NextResponse.json(
        { error: "NO_EMPLOYEE_PROFILE" },
        { status: 400 },
      );
    }

    const { action, lat, lng, timezone } = await req.json();
    const now = new Date();
    const tz = timezone || "Europe/Berlin";
    const timeStr = now.toLocaleTimeString("de-DE", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Date in the employee's timezone (may differ from UTC date near midnight)
    const localDateStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
    const [ly, lm, ld] = localDateStr.split("-").map(Number);
    const dateOnly = new Date(Date.UTC(ly, lm - 1, ld));

    // ── Clock In ──
    if (action === "in") {
      const open = await prisma.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
      });
      if (open) {
        return NextResponse.json(
          { error: "ALREADY_CLOCKED_IN", entryId: open.id },
          { status: 409 },
        );
      }

      const entry = await prisma.timeEntry.create({
        data: {
          date: dateOnly,
          startTime: timeStr,
          endTime: timeStr,
          isLiveClock: true,
          clockInAt: now,
          clockInLat: lat ?? null,
          clockInLng: lng ?? null,
          employeeId,
          workspaceId,
          status: "ENTWURF",
        },
      });

      return NextResponse.json(entry, { status: 201 });
    }

    // ── Break Start ──
    if (action === "break-start") {
      const open = await prisma.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
        orderBy: { clockInAt: "desc" },
      });
      if (!open) {
        return NextResponse.json({ error: "NOT_CLOCKED_IN" }, { status: 404 });
      }
      if (open.breakStart && !open.breakEnd) {
        return NextResponse.json(
          { error: "BREAK_ALREADY_ACTIVE" },
          { status: 409 },
        );
      }

      const entry = await prisma.timeEntry.update({
        where: { id: open.id },
        data: { breakStart: timeStr },
      });
      return NextResponse.json(entry);
    }

    // ── Break End ──
    if (action === "break-end") {
      const open = await prisma.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
        orderBy: { clockInAt: "desc" },
      });
      if (!open || !open.breakStart) {
        return NextResponse.json({ error: "NO_ACTIVE_BREAK" }, { status: 404 });
      }

      // Calculate break duration in minutes
      const bsMin = toMinutes(open.breakStart);
      const beMin = toMinutes(timeStr);
      const breakMinutes = Math.max(0, beMin - bsMin);

      const entry = await prisma.timeEntry.update({
        where: { id: open.id },
        data: { breakEnd: timeStr, breakMinutes },
      });
      return NextResponse.json(entry);
    }

    // ── Clock Out ──
    if (action === "out") {
      const open = await prisma.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
        orderBy: { clockInAt: "desc" },
      });
      if (!open) {
        return NextResponse.json({ error: "NOT_CLOCKED_IN" }, { status: 404 });
      }

      // If break is still running, auto-end it now
      let breakMinutes = open.breakMinutes || 0;
      let breakEnd = open.breakEnd;
      if (open.breakStart && !open.breakEnd) {
        const bsMin = toMinutes(open.breakStart);
        const beMin = toMinutes(timeStr);
        breakMinutes = Math.max(0, beMin - bsMin);
        breakEnd = timeStr;
      }

      const clockIn = open.clockInAt!;
      const diffMs = now.getTime() - clockIn.getTime();
      const grossMinutes = Math.round(diffMs / 60000);
      // ArbZG legal break enforcement
      const legalBreak = ensureLegalBreak(grossMinutes, breakMinutes);
      const netMinutes = Math.max(0, grossMinutes - legalBreak);

      const entry = await prisma.timeEntry.update({
        where: { id: open.id },
        data: {
          endTime: timeStr,
          clockOutAt: now,
          clockOutLat: lat ?? null,
          clockOutLng: lng ?? null,
          breakEnd,
          breakMinutes: legalBreak,
          grossMinutes,
          netMinutes,
        },
      });

      return NextResponse.json(entry);
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    console.error("Clock error:", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * GET /api/time-entries/clock
 * Returns current clock-in status + today's completed entries for the employee.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const employeeId = user.employeeId;
    if (!employeeId) {
      return NextResponse.json({
        active: false,
        entry: null,
        todayEntries: [],
        noProfile: true,
      });
    }

    // Open (active) clock entry
    const open = await prisma.timeEntry.findFirst({
      where: { employeeId, isLiveClock: true, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });

    // Today's completed entries for the log (use Europe/Berlin)
    const berlinNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }),
    );
    const todayStart = new Date(berlinNow);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(berlinNow);
    todayEnd.setHours(23, 59, 59, 999);

    const todayEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        isLiveClock: true,
        clockOutAt: { not: null },
        clockInAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { clockInAt: "desc" },
    });

    return NextResponse.json({
      active: !!open,
      onBreak: open ? !!(open.breakStart && !open.breakEnd) : false,
      entry: open || null,
      todayEntries,
      noProfile: false,
    });
  } catch (error) {
    console.error("Clock status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
