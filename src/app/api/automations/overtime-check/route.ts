import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { checkOvertimeAlerts } from "@/lib/automations";

/**
 * POST /api/automations/overtime-check
 *
 * Checks all employees for overtime this week and creates
 * notifications for managers.
 * Can be called:
 *  - Manually by managers
 *  - Via Vercel Cron on Fridays at 16:00
 */
export async function POST(req: Request) {
  try {
    const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");

    if (cronSecret === process.env.CRON_SECRET && process.env.CRON_SECRET) {
      const workspaces = await prisma.workspace.findMany({
        select: { id: true },
      });

      const allAlerts: string[] = [];
      for (const ws of workspaces) {
        const result = await checkOvertimeAlerts(ws.id);
        allAlerts.push(...result.alerts);
      }

      return NextResponse.json({ success: true, alerts: allAlerts });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 },
      );
    }

    const result = await checkOvertimeAlerts(workspaceId);

    return NextResponse.json({
      success: true,
      alerts: result.alerts,
    });
  } catch (error) {
    console.error("Error checking overtime:", error);
    return NextResponse.json(
      { error: "Error checking overtime" },
      { status: 500 },
    );
  }
}
