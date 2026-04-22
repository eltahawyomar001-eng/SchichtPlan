import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { requireSchichtplanungAddon } from "@/lib/schichtplanung-addon";
import { runAutoScheduler } from "@/lib/auto-scheduler";
import { autoScheduleSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/shifts/auto-schedule
 *
 * Run the CSP-based auto-scheduler to assign employees to OPEN shifts.
 * Supports dry-run (preview) mode and configurable optimization weights.
 *
 * Body: { startDate, endDate, locationId?, dryRun?, weights? }
 */
export const POST = withRoute(
  "/api/shifts/auto-schedule",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    const addonRequired = await requireSchichtplanungAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const planGate = await requirePlanFeature(workspaceId, "autoScheduling");
    if (planGate) return planGate;

    const body = await req.json();
    const parsed = validateBody(autoScheduleSchema, body);
    if (!parsed.success) return parsed.response;

    const { startDate, endDate, locationId, dryRun, weights } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return NextResponse.json(
        { error: "endDate muss nach startDate liegen" },
        { status: 400 },
      );
    }

    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 31) {
      return NextResponse.json(
        { error: "Maximal 31 Tage pro Auto-Planung" },
        { status: 400 },
      );
    }

    // Get workspace bundesland
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { bundesland: true },
    });
    const bundesland = workspace?.bundesland || "HE";

    // ── Run the CSP solver ──
    const result = await runAutoScheduler({
      workspaceId,
      startDate: start,
      endDate: end,
      locationId: locationId || undefined,
      bundesland,
      weights,
    });

    // ── Save run to history ──
    const run = await prisma.autoScheduleRun.create({
      data: {
        status: dryRun ? "PREVIEW" : "APPLIED",
        startDate: start,
        endDate: end,
        locationId: locationId || null,
        totalOpenShifts: result.totalOpenShifts,
        assignedCount: result.assignedCount,
        unresolvedCount: result.unresolvedCount,
        totalCostEstimate: result.totalCostEstimate,
        fairnessScore: result.fairnessScore,
        assignments: JSON.parse(JSON.stringify(result.assignments)),
        unresolvedShifts: JSON.parse(JSON.stringify(result.unresolvedShifts)),
        configSnapshot: { weights, locationId, bundesland },
        appliedAt: dryRun ? null : new Date(),
        userId: user.id,
        workspaceId,
      },
    });

    // ── Apply assignments (unless dry run) ──
    if (!dryRun && result.assignments.length > 0) {
      await prisma.$transaction(
        result.assignments.map((a) =>
          prisma.shift.update({
            where: { id: a.shiftId },
            data: {
              employeeId: a.employeeId,
              status: "SCHEDULED",
            },
          }),
        ),
      );

      createAuditLog({
        action: "CREATE",
        entityType: "AutoSchedule",
        entityId: run.id,
        userId: user.id,
        userEmail: user.email!,
        workspaceId,
        metadata: {
          startDate,
          endDate,
          locationId: locationId || null,
          assigned: result.assignedCount,
          unresolved: result.unresolvedCount,
          totalCost: result.totalCostEstimate,
          fairness: result.fairnessScore,
        },
      });

      log.info("[auto-schedule] Applied", {
        runId: run.id,
        assigned: result.assignedCount,
        unresolved: result.unresolvedCount,
      });
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      dryRun,
      assigned: result.assignedCount,
      unresolved: result.unresolvedCount,
      totalOpenShifts: result.totalOpenShifts,
      totalCostEstimate: result.totalCostEstimate,
      fairnessScore: result.fairnessScore,
      assignments: result.assignments,
      unresolvedShifts: result.unresolvedShifts,
      employeeHours: result.employeeHours,
    });
  },
  { idempotent: true },
);

/**
 * GET /api/shifts/auto-schedule
 *
 * List auto-schedule run history for the workspace.
 * Query params: ?limit=10&status=APPLIED
 */
export const GET = withRoute(
  "/api/shifts/auto-schedule",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const status = searchParams.get("status");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { workspaceId };
    if (status) where.status = status;

    const runs = await prisma.autoScheduleRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        location: { select: { name: true } },
      },
    });

    return NextResponse.json({ runs });
  },
);
