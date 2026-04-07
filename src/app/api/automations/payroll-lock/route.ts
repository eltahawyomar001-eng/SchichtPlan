import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lockMonthTimeEntries } from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError, cronMonitor } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { payrollLockSchema, validateBody } from "@/lib/validations";

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
export const POST = withRoute(
  "/api/automations/payroll-lock",
  "POST",
  async (req) => {
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

      const monitor = cronMonitor("payroll-lock", "0 4 1 * *");
      try {
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

        monitor.finish("ok");
        return NextResponse.json({
          success: true,
          totalLocked,
          month: `${defaultYear}-${String(defaultMonth).padStart(2, "0")}`,
        });
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
      const parsed = validateBody(payrollLockSchema, body);
      if (parsed.success) {
        if (parsed.data.year) year = parsed.data.year;
        if (parsed.data.month) month = parsed.data.month;
      }
    } catch {
      // Use defaults if no body
    }

    const result = await lockMonthTimeEntries(workspaceId, year, month);

    return NextResponse.json({
      success: true,
      locked: result.locked,
      month: result.month,
    });
  },
);
