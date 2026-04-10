import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTimeEntriesFromShifts } from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/automations/generate-time-entries
 *
 * Generates draft time entries from past shifts that don't have one yet.
 * Can be called:
 *  - Manually by managers via dashboard
 *  - Via Vercel Cron at 02:00 daily (with CRON_SECRET)
 */
export const POST = withRoute(
  "/api/automations/generate-time-entries",
  "POST",
  async (req) => {
    // Support both session auth and cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

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
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const manualWorkspaceId = user.workspaceId;
    if (!manualWorkspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await generateTimeEntriesFromShifts(manualWorkspaceId);

    return NextResponse.json({
      success: true,
      created: result.created,
    });
  },
);
