import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import ical, { ICalCalendarMethod } from "ical-generator";
import { log } from "@/lib/logger";

/**
 * Resolve the authenticated user — either via session cookie (browser)
 * or via a long-lived ?token= query parameter (external calendar apps).
 */
async function resolveUser(
  req: Request,
): Promise<{
  userId: string;
  employeeId?: string | null;
  workspaceId: string;
} | null> {
  // 1. Try token-based auth first (external calendar apps)
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (token) {
    const icalToken = await prisma.iCalToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            workspaceId: true,
            employee: { select: { id: true } },
          },
        },
      },
    });

    if (!icalToken || !icalToken.user.workspaceId) return null;

    // Update lastUsedAt (fire & forget)
    prisma.iCalToken
      .update({ where: { id: icalToken.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return {
      userId: icalToken.user.id,
      employeeId: icalToken.user.employee?.id ?? null,
      workspaceId: icalToken.user.workspaceId,
    };
  }

  // 2. Fall back to session-based auth (browser)
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = session.user as SessionUser;
  if (!user.workspaceId) return null;

  return {
    userId: user.id,
    employeeId: user.employeeId,
    workspaceId: user.workspaceId,
  };
}

/**
 * GET /api/ical
 * Returns an .ics feed of the user's shifts.
 * Auth: session cookie OR ?token= query parameter.
 * Query params: start, end (optional date filters)
 */
export async function GET(req: Request) {
  try {
    const authedUser = await resolveUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { employeeId, workspaceId } = authedUser;

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
      name: "Shiftfy",
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
        "Content-Disposition": "attachment; filename=shiftfy-schichtplan.ics",
      },
    });
  } catch (error) {
    log.error("iCal error:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
