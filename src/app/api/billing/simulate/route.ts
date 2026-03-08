import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { isSimulationMode, simulateSubscription } from "@/lib/subscription";
import { syncUsageLimits } from "@/lib/subscription-guard";
import type { PlanId } from "@/lib/stripe";
import { PLANS } from "@/lib/stripe";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/simulate
 *
 * Simulates a plan change without Stripe. Only works when
 * STRIPE_SIMULATION_MODE=true. Used for testing/demo purposes.
 * Blocked entirely in production for security.
 *
 * Body: { plan: "basic"|"professional"|"enterprise", billingCycle: "monthly"|"annual" }
 */
export async function POST(req: Request) {
  try {
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

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const body = await req.json();
    const { plan, billingCycle = "monthly" } = body;

    // Validate plan
    const validPlans: PlanId[] = ["basic", "professional", "enterprise"];
    if (!plan || !validPlans.includes(plan)) {
      return NextResponse.json(
        {
          error: "Invalid plan. Must be basic, professional, or enterprise.",
        },
        { status: 400 },
      );
    }

    // Validate billing cycle
    if (!["monthly", "annual"].includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billingCycle. Must be monthly or annual." },
        { status: 400 },
      );
    }

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

    return NextResponse.json({
      success: true,
      simulation: true,
      plan: result.plan,
      status: result.status,
      currentPeriodEnd: result.currentPeriodEnd,
      trialEnd: result.trialEnd,
      limits: planConfig?.limits,
    });
  } catch (error) {
    log.error("[Billing:Simulate] Error:", { error });
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}

/**
 * GET /api/billing/simulate
 * Returns whether simulation mode is enabled. Blocked in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    simulationMode: isSimulationMode(),
  });
}
