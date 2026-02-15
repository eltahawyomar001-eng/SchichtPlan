import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { generateTimeEntriesFromShifts } from "@/lib/automations";

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
    const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
    let workspaceId: string | null = null;

    if (cronSecret === process.env.CRON_SECRET && process.env.CRON_SECRET) {
      // Cron job: process all workspaces
      const workspaces = await prisma.workspace.findMany({
        select: { id: true },
      });

      let totalCreated = 0;
      for (const ws of workspaces) {
        const result = await generateTimeEntriesFromShifts(ws.id);
        totalCreated += result.created;
      }

      return NextResponse.json({
        success: true,
        totalCreated,
        workspacesProcessed: workspaces.length,
      });
    }

    // Manual: require session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 },
      );
    }

    const result = await generateTimeEntriesFromShifts(workspaceId);

    return NextResponse.json({
      success: true,
      created: result.created,
    });
  } catch (error) {
    console.error("Error generating time entries:", error);
    return NextResponse.json(
      { error: "Error with automatic time tracking" },
      { status: 500 },
    );
  }
}
