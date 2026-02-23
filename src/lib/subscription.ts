import { prisma } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/stripe";

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
      plan: "STARTER",
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
      plan: "STARTER",
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
  if (!sub) return true; // No subscription = starter defaults

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
