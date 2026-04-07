import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { isSimulationMode, simulateSubscription } from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import type { PlanId } from "@/lib/stripe";
import { PLANS } from "@/lib/stripe";
import { billingSimulateSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/billing/simulate
 *
 * Simulates a plan change without Stripe. Only works when
 * STRIPE_SIMULATION_MODE=true. Used for testing/demo purposes.
 * Blocked entirely in production for security.
 *
 * Body: { plan: "basic"|"professional"|"enterprise", billingCycle: "monthly"|"annual" }
 */
export const POST = withRoute(
  "/api/billing/simulate",
  "POST",
  async (req) => {
    // Hard block in production — never allow simulation with real billing
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 404 },
      );
    }

    // Guard: only works in simulation mode
    if (!isSimulationMode()) {
      return NextResponse.json(
        { error: "Simulation mode is not enabled" },
        { status: 403 },
      );
    }

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const parsed = validateBody(billingSimulateSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { plan, billingCycle } = parsed.data;

    const result = await simulateSubscription({
      workspaceId: user.workspaceId,
      plan: plan as PlanId,
      billingCycle,
    });

    // Sync usage limits to match the simulated plan
    await syncUsageLimits(user.workspaceId, plan as PlanId);

    const planConfig = PLANS[plan as PlanId];

    log.info(
      `[Billing:Simulate] Workspace ${user.workspaceId} → ${plan} (${billingCycle})`,
    );

    createAuditLog({
      action: "UPDATE",
      entityType: "Subscription",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "SIMULATE", plan, billingCycle },
    });

    return NextResponse.json({
      success: true,
      simulation: true,
      plan: result.plan,
      status: result.status,
      currentPeriodEnd: result.currentPeriodEnd,
      trialEnd: result.trialEnd,
      limits: planConfig?.limits,
    });
  },
  { idempotent: true },
);

/**
 * GET /api/billing/simulate
 * Returns whether simulation mode is enabled. Blocked in production.
 */
export const GET = withRoute("/api/billing/simulate", "GET", async (req) => {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    simulationMode: isSimulationMode(),
  });
});
