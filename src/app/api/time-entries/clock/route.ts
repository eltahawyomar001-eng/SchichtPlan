import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/**
 * POST /api/time-entries/clock
 * Live punch-clock: clock-in or clock-out with optional GPS.
 *
 * Body: { action: "in" | "out", lat?: number, lng?: number, locationId?: string, projectId?: string }
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
        { error: "No employee profile linked" },
        { status: 400 },
      );
    }

    const { action, lat, lng, locationId, projectId } = await req.json();

    if (action === "in") {
      // Check for already open clock
      const open = await prisma.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
      });
      if (open) {
        return NextResponse.json(
          { error: "Already clocked in", entryId: open.id },
          { status: 409 },
        );
      }

      const now = new Date();
      const dateOnly = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const entry = await prisma.timeEntry.create({
        data: {
          date: dateOnly,
          startTime: timeStr,
          endTime: timeStr, // placeholder until clock-out
          isLiveClock: true,
          clockInAt: now,
          clockInLat: lat ?? null,
          clockInLng: lng ?? null,
          employeeId,
          workspaceId,
          locationId: locationId ?? null,
          projectId: projectId ?? null,
          status: "ENTWURF",
        },
      });

      return NextResponse.json(entry, { status: 201 });
    }

    if (action === "out") {
      const open = await prisma.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
        orderBy: { clockInAt: "desc" },
      });
      if (!open) {
        return NextResponse.json(
          { error: "No active clock-in found" },
          { status: 404 },
        );
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      // Calculate gross minutes
      const clockIn = open.clockInAt!;
      const diffMs = now.getTime() - clockIn.getTime();
      const grossMinutes = Math.round(diffMs / 60000);
      const netMinutes = Math.max(0, grossMinutes - (open.breakMinutes || 0));

      const entry = await prisma.timeEntry.update({
        where: { id: open.id },
        data: {
          endTime: timeStr,
          clockOutAt: now,
          clockOutLat: lat ?? null,
          clockOutLng: lng ?? null,
          grossMinutes,
          netMinutes,
        },
      });

      return NextResponse.json(entry);
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'in' or 'out'." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Clock error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/time-entries/clock
 * Check current clock-in status for the authenticated employee.
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
      return NextResponse.json({ active: false });
    }

    const open = await prisma.timeEntry.findFirst({
      where: { employeeId, isLiveClock: true, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });

    return NextResponse.json({ active: !!open, entry: open || null });
  } catch (error) {
    console.error("Clock status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
