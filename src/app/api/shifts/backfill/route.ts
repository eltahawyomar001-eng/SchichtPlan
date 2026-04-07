import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { runBackfill } from "@/lib/auto-scheduler";
import { backfillSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

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
export const POST = withRoute(
  "/api/shifts/backfill",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
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
  },
  { idempotent: true },
);
