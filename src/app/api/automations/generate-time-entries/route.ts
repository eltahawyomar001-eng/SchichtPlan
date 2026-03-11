import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { generateTimeEntriesFromShifts } from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";

/**
 * POST /api/automations/generate-time-entries
 *
 * Generates draft time entries from past shifts that don't have one yet.
 * Can be called:
 *  - Manually by managers via dashboard
 *  - Via Vercel Cron at 02:00 daily (with CRON_SECRET)
 */
export async function POST(req: Request) {
  try {
    // Support both session auth and cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");
    let workspaceId: string | null = null;

    // If a Bearer token was provided, it MUST match CRON_SECRET
    if (authHeader?.startsWith("Bearer ")) {
      if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json(
          { error: "Invalid cron secret" },
          { status: 403 },
        );
      }

      // Cron job: process all workspaces
      const monitor = cronMonitor("generate-time-entries", "0 2 * * *");
      try {
        const workspaces = await prisma.workspace.findMany({
          select: { id: true },
        });

        let totalCreated = 0;
        for (const ws of workspaces) {
          const result = await generateTimeEntriesFromShifts(ws.id);
          totalCreated += result.created;
        }

        monitor.finish("ok");
        return NextResponse.json({
          success: true,
          totalCreated,
          workspacesProcessed: workspaces.length,
        });
      } catch (cronError) {
        monitor.finish("error");
        throw cronError;
      }
    }

    // Manual: require session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await generateTimeEntriesFromShifts(workspaceId);

    return NextResponse.json({
      success: true,
      created: result.created,
    });
  } catch (error) {
    log.error("Error generating time entries:", { error: error });
    captureRouteError(error, {
      route: "/api/automations/generate-time-entries",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Error with automatic time tracking" },
      { status: 500 },
    );
  }
}
