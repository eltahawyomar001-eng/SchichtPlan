import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { getSubscriptionState } from "@/lib/subscription";

/** Subscription states that allow dashboard access. */
const ALLOWED_SUB_STATES = ["active", "trial_expired"] as const;

/**
 * POST /api/onboarding/complete
 *
 * Marks the workspace onboarding as completed.
 * Requires an active or trialing Stripe subscription so that users cannot
 * skip the payment funnel by calling this endpoint directly.
 */
export const POST = withRoute(
  "/api/onboarding/complete",
  "POST",
  async (_req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    // Server-side subscription gate — prevents bypass via direct API call.
    const subState = await getSubscriptionState(user.workspaceId);
    if (
      !ALLOWED_SUB_STATES.includes(
        subState as (typeof ALLOWED_SUB_STATES)[number],
      )
    ) {
      // Re-check: if the workspace has any ACTIVE/TRIALING/PAST_DUE subscription
      // row we accept it (covers Stripe webhook timing edge cases).
      const sub = await prisma.subscription.findUnique({
        where: { workspaceId: user.workspaceId },
        select: { status: true },
      });
      const validStatuses = ["ACTIVE", "TRIALING", "PAST_DUE"];
      if (!sub || !validStatuses.includes(sub.status)) {
        return NextResponse.json(
          {
            error: "SUBSCRIPTION_REQUIRED",
            message: "A valid subscription is required to complete onboarding.",
          },
          { status: 402 },
        );
      }
    }

    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: { onboardingCompleted: true },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Workspace",
      entityId: user.workspaceId,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "ONBOARDING_COMPLETE" },
    });

    log.info("Onboarding completed", {
      workspaceId: user.workspaceId,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  },
  { idempotent: true },
);
