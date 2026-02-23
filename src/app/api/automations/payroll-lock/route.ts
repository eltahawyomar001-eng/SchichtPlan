import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { lockMonthTimeEntries } from "@/lib/automations";
import { log } from "@/lib/logger";

/**
 * POST /api/automations/payroll-lock
 *
 * Locks all reviewed time entries for a completed month.
 * Body: { year: number, month: number } (optional — defaults to previous month)
 *
 * Can be called:
 *  - Manually by managers
 *  - Via Vercel Cron on the 6th of each month at 00:00
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    // Determine which month to lock
    const now = new Date();
    const defaultYear =
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month

    // If a Bearer token was provided, it MUST match CRON_SECRET
    if (authHeader?.startsWith("Bearer ")) {
      if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json(
          { error: "Invalid cron secret" },
          { status: 403 },
        );
      }

      const workspaces = await prisma.workspace.findMany({
        select: { id: true },
      });

      let totalLocked = 0;
      for (const ws of workspaces) {
        const result = await lockMonthTimeEntries(
          ws.id,
          defaultYear,
          defaultMonth,
        );
        totalLocked += result.locked;
      }

      return NextResponse.json({
        success: true,
        totalLocked,
        month: `${defaultYear}-${String(defaultMonth).padStart(2, "0")}`,
      });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN"].includes(user.role ?? "")) {
      return NextResponse.json(
        { error: "Only admins can lock months" },
        { status: 403 },
      );
    }

    let year = defaultYear;
    let month = defaultMonth;

    try {
      const body = await req.json();
      if (body.year) year = body.year;
      if (body.month) month = body.month;
    } catch {
      // Use defaults if no body
    }

    const result = await lockMonthTimeEntries(workspaceId, year, month);

    return NextResponse.json({
      success: true,
      locked: result.locked,
      month: result.month,
    });
  } catch (error) {
    log.error("Error locking payroll:", { error: error });
    return NextResponse.json(
      { error: "Error locking payroll" },
      { status: 500 },
    );
  }
}
