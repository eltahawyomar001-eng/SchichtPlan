import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PLANS, type PlanId, type PlanConfig } from "@/lib/stripe";

/* ═══════════════════════════════════════════════════════════════
   Subscription service — database operations
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ensure a workspace has a Subscription row.
 * Called during workspace creation or first billing interaction.
 */
export async function ensureSubscription(workspaceId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing;

  return prisma.subscription.create({
    data: {
      workspaceId,
      plan: "BASIC",
      status: "ACTIVE",
      seatCount: 1,
    },
  });
}

/**
 * Get the current subscription for a workspace.
 */
export async function getSubscription(workspaceId: string) {
  return prisma.subscription.findUnique({
    where: { workspaceId },
  });
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
 */
export async function cancelSubscription(stripeSubscriptionId: string) {
  return prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      plan: "BASIC",
      status: "CANCELED",
      stripePriceId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    },
  });
}

/**
 * Check if a workspace can add more employees based on plan limits.
 */
export async function canAddEmployee(workspaceId: string): Promise<boolean> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return true; // No subscription = basic defaults

  const planId = sub.plan.toLowerCase() as PlanId;
  const plan = PLANS[planId];
  if (!plan) return true;

  if (plan.limits.maxEmployees === Infinity) return true;

  const employeeCount = await prisma.employee.count({
    where: { workspaceId, isActive: true },
  });

  return employeeCount < plan.limits.maxEmployees;
}

/**
 * Check if a workspace can add more locations based on plan limits.
 */
export async function canAddLocation(workspaceId: string): Promise<boolean> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return true;

  const planId = sub.plan.toLowerCase() as PlanId;
  const plan = PLANS[planId];
  if (!plan) return true;

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
 * Get the plan config for a workspace. Falls back to BASIC.
 */
export async function getWorkspacePlan(
  workspaceId: string,
): Promise<PlanConfig> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return PLANS.basic;

  // Only active/trialing subscriptions unlock paid features
  const activeStatuses = ["ACTIVE", "TRIALING"];
  if (!activeStatuses.includes(sub.status)) return PLANS.basic;

  const planId = sub.plan.toLowerCase() as PlanId;
  return PLANS[planId] ?? PLANS.basic;
}

/**
 * Check if a workspace has access to a boolean feature.
 */
export async function canUseFeature(
  workspaceId: string,
  feature: FeatureKey,
): Promise<boolean> {
  const plan = await getWorkspacePlan(workspaceId);
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
 * Server-side guard for employee creation. Returns 403 if limit reached.
 */
export async function requireEmployeeSlot(
  workspaceId: string,
): Promise<NextResponse | null> {
  const allowed = await canAddEmployee(workspaceId);
  if (allowed) return null;

  const plan = await getWorkspacePlan(workspaceId);
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
 * Server-side guard for location creation. Returns 403 if limit reached.
 */
export async function requireLocationSlot(
  workspaceId: string,
): Promise<NextResponse | null> {
  const allowed = await canAddLocation(workspaceId);
  if (allowed) return null;

  const plan = await getWorkspacePlan(workspaceId);
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

  // Simulate activation
  const trialEnd =
    planConfig.trialDays > 0
      ? new Date(now.getTime() + planConfig.trialDays * 24 * 60 * 60 * 1000)
      : null;

  return prisma.subscription.upsert({
    where: { workspaceId },
    update: {
      plan: planConfig.prismaKey,
      status: trialEnd ? "TRIALING" : "ACTIVE",
      stripeCustomerId: `sim_cus_${workspaceId.slice(0, 8)}`,
      stripeSubscriptionId: `sim_sub_${Date.now()}`,
      stripePriceId: `sim_price_${plan}_${billingCycle}`,
      seatCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: trialEnd ? now : null,
      trialEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      workspaceId,
      plan: planConfig.prismaKey,
      status: trialEnd ? "TRIALING" : "ACTIVE",
      stripeCustomerId: `sim_cus_${workspaceId.slice(0, 8)}`,
      stripeSubscriptionId: `sim_sub_${Date.now()}`,
      stripePriceId: `sim_price_${plan}_${billingCycle}`,
      seatCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: trialEnd ? now : null,
      trialEnd,
    },
  });
}
