import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PLANS, type PlanId, type PlanConfig } from "@/lib/stripe";

/* ═══════════════════════════════════════════════════════════════
   Subscription service — database operations
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ensure a Subscription row exists for the workspace.
 *
 * Used by the checkout/billing routes where Stripe needs a stable record to
 * attach a customer/session to. The created row is INCOMPLETE — it grants
 * NO application access on its own. Access is unlocked only when Stripe
 * confirms payment and the row is upgraded to ACTIVE/TRIALING by the
 * webhook handler.
 *
 * Important: do NOT call this during user/workspace registration. New
 * workspaces must complete checkout first; until they do, the dashboard
 * layout redirects them to the pricing/billing page.
 */
export async function ensureSubscription(workspaceId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing;

  return prisma.subscription.create({
    data: {
      workspaceId,
      plan: "BASIC", // placeholder — overwritten by checkout-completed webhook
      status: "INCOMPLETE", // does NOT grant access
      seatCount: 1,
    },
  });
}

/**
 * Get the current subscription for a workspace.
 *
 * Note: A workspace without a subscription has *no* dashboard access — see
 * hasActiveSubscription().
 */
export async function getSubscription(workspaceId: string) {
  return prisma.subscription.findUnique({
    where: { workspaceId },
  });
}

/**
 * Statuses that grant access to the application.
 *
 * - ACTIVE: paid and current
 * - TRIALING: Stripe trial granted by checkout (we don't auto-create trials,
 *   but Stripe-side promotional trials are honoured if the customer reaches
 *   checkout with a Stripe coupon that includes a trial period)
 * - PAST_DUE: keep access for the dunning grace window so the user can
 *   update payment in the billing portal; switch to read-only banner UX
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
] as const;

/**
 * True iff the workspace currently has a subscription that grants app access.
 * Used by the dashboard layout to hard-gate the entire authenticated UI.
 */
export async function hasActiveSubscription(
  workspaceId: string,
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { status: true },
  });
  if (!sub) return false;
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(
    sub.status,
  );
}

/**
 * Activate a paid subscription after Stripe checkout completes.
 */
export async function activateSubscription({
  workspaceId,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  plan,
  seatCount,
  currentPeriodStart,
  currentPeriodEnd,
  trialStart,
  trialEnd,
  status,
}: {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: PlanId;
  seatCount: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  status: string;
}) {
  const planConfig = PLANS[plan];

  return prisma.subscription.upsert({
    where: { workspaceId },
    update: {
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      plan: planConfig.prismaKey,
      status: mapStripeStatus(status),
      seatCount,
      currentPeriodStart,
      currentPeriodEnd,
      trialStart,
      trialEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      workspaceId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      plan: planConfig.prismaKey,
      status: mapStripeStatus(status),
      seatCount,
      currentPeriodStart,
      currentPeriodEnd,
      trialStart,
      trialEnd,
    },
  });
}

/**
 * Update subscription when Stripe sends subscription.updated event.
 */
export async function updateSubscriptionFromStripe({
  stripeSubscriptionId,
  stripePriceId,
  status,
  seatCount,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  seatCount: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}) {
  return prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      stripePriceId,
      status: mapStripeStatus(status),
      seatCount,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
  });
}

/**
 * Downgrade to free when subscription is cancelled/deleted.
 *
 * The workspace loses dashboard access immediately (status=CANCELED), but the
 * row is kept so the user can resubscribe and we retain the Stripe customer
 * link for restored billing history.
 */
export async function cancelSubscription(stripeSubscriptionId: string) {
  return prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      status: "CANCELED",
      // Keep `plan` and `stripeCustomerId` so the customer can resubscribe
      // without losing their historical context. Active access is gated by
      // status, not by plan.
      stripePriceId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      ticketingTier: "NONE",
      ticketingStripeSubscriptionItemId: null,
      schichtplanungAddonActive: false,
      schichtplanungAddonBilling: null,
      schichtplanungStripeSubscriptionItemId: null,
    },
  });
}

/**
 * Check if a workspace can add more employees based on plan limits.
 * Returns false when there is no active subscription — the gate is upstream
 * (dashboard layout) but defence-in-depth here too.
 */
export async function canAddEmployee(workspaceId: string): Promise<boolean> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return false;
  if (!(ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status))
    return false;

  const planId = sub.plan.toLowerCase() as PlanId;
  const plan = PLANS[planId];
  if (!plan) return false;

  if (plan.limits.maxEmployees === Infinity) return true;

  const employeeCount = await prisma.employee.count({
    where: { workspaceId, isActive: true },
  });

  return employeeCount < plan.limits.maxEmployees;
}

/**
 * Check if a workspace can add more locations based on plan limits.
 * Returns false when there is no active subscription.
 */
export async function canAddLocation(workspaceId: string): Promise<boolean> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return false;
  if (!(ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status))
    return false;

  const planId = sub.plan.toLowerCase() as PlanId;
  const plan = PLANS[planId];
  if (!plan) return false;

  if (plan.limits.maxLocations === Infinity) return true;

  const locationCount = await prisma.location.count({
    where: { workspaceId },
  });

  return locationCount < plan.limits.maxLocations;
}

/* ───── Internal helpers ───── */

type PrismaSubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "PAUSED";

function mapStripeStatus(status: string): PrismaSubscriptionStatus {
  const map: Record<string, PrismaSubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    paused: "PAUSED",
  };
  return map[status] ?? "ACTIVE";
}

/* ═══════════════════════════════════════════════════════════════
   Feature gating — server-side enforcement
   ═══════════════════════════════════════════════════════════════ */

export type FeatureKey = keyof PlanConfig["limits"];

/**
 * Get the plan config for a workspace.
 *
 * Returns `null` when the workspace has no active subscription. Callers MUST
 * handle this — the previous behaviour of falling back to a free Basic plan
 * was a major bug that let unbilled workspaces use the app.
 */
export async function getWorkspacePlan(
  workspaceId: string,
): Promise<PlanConfig | null> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return null;

  if (
    !(ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status)
  ) {
    return null;
  }

  const planId = sub.plan.toLowerCase() as PlanId;
  return PLANS[planId] ?? null;
}

/**
 * Check if a workspace has access to a boolean feature.
 * Returns false when there is no active subscription.
 */
export async function canUseFeature(
  workspaceId: string,
  feature: FeatureKey,
): Promise<boolean> {
  const plan = await getWorkspacePlan(workspaceId);
  if (!plan) return false;
  const value = plan.limits[feature];
  if (typeof value === "boolean") return value;
  // Numeric limits always "available" — use canAddEmployee/canAddLocation
  return true;
}

/**
 * Server-side guard. Returns a 403 NextResponse if the feature is gated,
 * or null if access is allowed. Use in API routes:
 *
 *   const denied = await requirePlanFeature(workspaceId, "datevExport");
 *   if (denied) return denied;
 */
export async function requirePlanFeature(
  workspaceId: string,
  feature: FeatureKey,
): Promise<NextResponse | null> {
  const allowed = await canUseFeature(workspaceId, feature);
  if (allowed) return null;

  return NextResponse.json(
    {
      error: "PLAN_LIMIT",
      message: `Your current plan does not include this feature. Please upgrade to access it.`,
      feature,
    },
    { status: 403 },
  );
}

/**
 * Server-side guard for employee creation. Returns 403 if limit reached or
 * 402 if no active subscription.
 */
export async function requireEmployeeSlot(
  workspaceId: string,
): Promise<NextResponse | null> {
  const allowed = await canAddEmployee(workspaceId);
  if (allowed) return null;

  const plan = await getWorkspacePlan(workspaceId);
  if (!plan) {
    return NextResponse.json(
      {
        error: "SUBSCRIPTION_REQUIRED",
        message:
          "Kein aktives Abonnement. Bitte wählen Sie einen Plan, um fortzufahren.",
      },
      { status: 402 },
    );
  }
  return NextResponse.json(
    {
      error: "PLAN_LIMIT",
      message: `You have reached the maximum of ${plan.limits.maxEmployees} employees on your current plan. Please upgrade to add more.`,
      feature: "maxEmployees",
      limit: plan.limits.maxEmployees,
    },
    { status: 403 },
  );
}

/**
 * Server-side guard for location creation. Returns 403 if limit reached or
 * 402 if no active subscription.
 */
export async function requireLocationSlot(
  workspaceId: string,
): Promise<NextResponse | null> {
  const allowed = await canAddLocation(workspaceId);
  if (allowed) return null;

  const plan = await getWorkspacePlan(workspaceId);
  if (!plan) {
    return NextResponse.json(
      {
        error: "SUBSCRIPTION_REQUIRED",
        message:
          "Kein aktives Abonnement. Bitte wählen Sie einen Plan, um fortzufahren.",
      },
      { status: 402 },
    );
  }
  return NextResponse.json(
    {
      error: "PLAN_LIMIT",
      message: `You have reached the maximum of ${plan.limits.maxLocations} locations on your current plan. Please upgrade to add more.`,
      feature: "maxLocations",
      limit: plan.limits.maxLocations,
    },
    { status: 403 },
  );
}

/* ═══════════════════════════════════════════════════════════════
   Stripe Simulation Mode
   ═══════════════════════════════════════════════════════════════
   When STRIPE_SIMULATION_MODE=true, billing flows skip real Stripe
   and directly update the database. This lets testers subscribe,
   upgrade, and downgrade without real payments.

   Set STRIPE_SIMULATION_MODE=true in .env for testing.
   Remove or set to false before connecting real Stripe.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check if Stripe simulation mode is enabled.
 */
export function isSimulationMode(): boolean {
  return process.env.STRIPE_SIMULATION_MODE === "true";
}

/**
 * Simulate a plan change without Stripe.
 * Directly updates the subscription in the database.
 */
export async function simulateSubscription({
  workspaceId,
  plan,
  billingCycle,
}: {
  workspaceId: string;
  plan: PlanId;
  billingCycle: "monthly" | "annual";
}) {
  const planConfig = PLANS[plan];
  if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(
    periodEnd.getMonth() + (billingCycle === "annual" ? 12 : 1),
  );

  // No trial — direct activation only.
  return prisma.subscription.upsert({
    where: { workspaceId },
    update: {
      plan: planConfig.prismaKey,
      status: "ACTIVE",
      stripeCustomerId: `sim_cus_${workspaceId.slice(0, 8)}`,
      stripeSubscriptionId: `sim_sub_${Date.now()}`,
      stripePriceId: `sim_price_${plan}_${billingCycle}`,
      seatCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
    },
    create: {
      workspaceId,
      plan: planConfig.prismaKey,
      status: "ACTIVE",
      stripeCustomerId: `sim_cus_${workspaceId.slice(0, 8)}`,
      stripeSubscriptionId: `sim_sub_${Date.now()}`,
      stripePriceId: `sim_price_${plan}_${billingCycle}`,
      seatCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: null,
      trialEnd: null,
    },
  });
}
