import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { getSubscription, ensureSubscription } from "@/lib/subscription";
import { PLANS, type PlanId } from "@/lib/stripe";

/**
 * GET /api/billing/subscription
 * Returns the current workspace subscription status and plan limits.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    let sub = await getSubscription(user.workspaceId);

    // Auto-create starter subscription if none exists
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
      limits: planConfig?.limits ?? PLANS.starter.limits,
    });
  } catch (error) {
    console.error("[Billing] Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 },
    );
  }
}
