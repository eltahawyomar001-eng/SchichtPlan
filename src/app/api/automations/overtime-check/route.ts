import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkOvertimeAlerts } from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/automations/overtime-check
 *
 * Checks all employees for overtime this week and creates
 * notifications for managers.
 * Can be called:
 *  - Manually by managers
 *  - Via Vercel Cron on Fridays at 16:00
 */
export const POST = withRoute(
  "/api/automations/overtime-check",
  "POST",
  async (req) => {
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

      const monitor = cronMonitor("overtime-check", "0 3 * * 1");
      try {
        const workspaces = await prisma.workspace.findMany({
          select: { id: true },
        });

        const allAlerts: string[] = [];
        for (const ws of workspaces) {
          const result = await checkOvertimeAlerts(ws.id);
          allAlerts.push(...result.alerts);
        }

        monitor.finish("ok");
        return NextResponse.json({ success: true, alerts: allAlerts });
      } catch (cronError) {
        monitor.finish("error");
        throw cronError;
      }
    }

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await checkOvertimeAlerts(workspaceId);

    return NextResponse.json({
      success: true,
      alerts: result.alerts,
    });
  },
);
