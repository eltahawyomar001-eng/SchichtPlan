import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { runBackfill } from "@/lib/auto-scheduler";
import { backfillSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

/**
 * POST /api/shifts/backfill
 *
 * Find replacement candidates for a single shift (instant backfill).
 * Used when an employee calls sick and needs to be replaced.
 *
 * Body: { shiftId, maxCandidates? }
 *
 * Returns a ranked list of available employees who can fill the shift,
 * scored by fairness, preference, fatigue, rotation, and cost.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const planGate = await requirePlanFeature(workspaceId, "autoScheduling");
    if (planGate) return planGate;

    const body = await req.json();
    const parsed = validateBody(backfillSchema, body);
    if (!parsed.success) return parsed.response;

    const { shiftId, maxCandidates } = parsed.data;

    // Verify shift belongs to this workspace
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, workspaceId },
    });

    if (!shift) {
      return NextResponse.json(
        { error: "Schicht nicht gefunden" },
        { status: 404 },
      );
    }

    // Get workspace bundesland
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { bundesland: true },
    });
    const bundesland = workspace?.bundesland || "HE";

    // Run backfill search
    const result = await runBackfill({
      workspaceId,
      shiftId,
      bundesland,
      maxCandidates,
    });

    log.info("[backfill] Completed", {
      shiftId,
      candidates: result.totalCandidates,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error("Error in backfill:", { error });
    return NextResponse.json(
      { error: "Fehler bei der Ersatzsuche" },
      { status: 500 },
    );
  }
}
