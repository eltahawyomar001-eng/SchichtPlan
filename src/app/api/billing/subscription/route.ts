import { NextResponse } from "next/server";
import {
  getSubscription,
  ensureSubscription,
  isSimulationMode,
} from "@/lib/subscription";
import { PLANS, type PlanId } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/billing/subscription
 * Returns the current workspace subscription status and plan limits.
 */
export const GET = withRoute(
  "/api/billing/subscription",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    let sub = await getSubscription(user.workspaceId);

    // Auto-create basic subscription if none exists
    if (!sub) {
      sub = await ensureSubscription(user.workspaceId);
    }

    const planId = sub.plan.toLowerCase() as PlanId;
    const planConfig = PLANS[planId];

    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      seatCount: sub.seatCount,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      trialEnd: sub.trialEnd,
      hasStripeSubscription: !!sub.stripeSubscriptionId,
      limits: planConfig?.limits ?? PLANS.basic.limits,
      simulationMode: isSimulationMode(),
    });
  },
);
