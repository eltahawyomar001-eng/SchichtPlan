import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/**
 * GET /api/time-entries/clock/team
 *
 * Returns today's live-clock entries for ALL employees in the workspace.
 * Only accessible to OWNER, ADMIN, MANAGER.
 *
 * Query params:
 *   timezone – IANA timezone string (default Europe/Berlin)
 *   date     – optional ISO date to query (default today in timezone)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Only management can view team data
    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("timezone") || "Europe/Berlin";
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD

    // Determine day boundaries in the given timezone
    let localNow: Date;
    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      localNow = new Date(y, m - 1, d, 12, 0, 0); // noon to avoid DST edge
    } else {
      localNow = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    }
    const dayStart = new Date(localNow);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(localNow);
    dayEnd.setHours(23, 59, 59, 999);

    // Currently active (open) clock entries for anyone in this workspace
    const activeEntries = await prisma.timeEntry.findMany({
      where: {
        workspaceId: user.workspaceId,
        isLiveClock: true,
        clockOutAt: null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
            position: true,
          },
        },
      },
      orderBy: { clockInAt: "asc" },
    });

    // Today's completed clock entries
    const completedEntries = await prisma.timeEntry.findMany({
      where: {
        workspaceId: user.workspaceId,
        isLiveClock: true,
        clockOutAt: { not: null },
        clockInAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
            position: true,
          },
        },
      },
      orderBy: { clockInAt: "desc" },
    });

    // All employees in workspace (to show who hasn't clocked in)
    const allEmployees = await prisma.employee.findMany({
      where: { workspaceId: user.workspaceId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        color: true,
        position: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    // Build per-employee summary
    const activeByEmployee = new Map<string, (typeof activeEntries)[0]>();
    for (const e of activeEntries) {
      activeByEmployee.set(e.employeeId, e);
    }

    const completedByEmployee = new Map<
      string,
      (typeof completedEntries)[number][]
    >();
    for (const e of completedEntries) {
      const arr = completedByEmployee.get(e.employeeId) || [];
      arr.push(e);
      completedByEmployee.set(e.employeeId, arr);
    }

    const team = allEmployees.map((emp) => {
      const active = activeByEmployee.get(emp.id) || null;
      const completed = completedByEmployee.get(emp.id) || [];
      const totalNetMinutes = completed.reduce(
        (sum, c) => sum + (c.netMinutes || 0),
        0,
      );

      let status: "offline" | "working" | "break" = "offline";
      if (active) {
        status = active.breakStart && !active.breakEnd ? "break" : "working";
      }

      return {
        employee: emp,
        status,
        active: active
          ? {
              id: active.id,
              clockInAt: active.clockInAt,
              startTime: active.startTime,
              breakStart: active.breakStart,
              breakEnd: active.breakEnd,
            }
          : null,
        completedCount: completed.length,
        totalNetMinutes,
      };
    });

    // Sort: working first, then break, then offline
    const order = { working: 0, break: 1, offline: 2 };
    team.sort((a, b) => order[a.status] - order[b.status]);

    return NextResponse.json({
      team,
      summary: {
        total: allEmployees.length,
        working: team.filter((t) => t.status === "working").length,
        onBreak: team.filter((t) => t.status === "break").length,
        offline: team.filter((t) => t.status === "offline").length,
      },
    });
  } catch (error) {
    console.error("Team clock status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
