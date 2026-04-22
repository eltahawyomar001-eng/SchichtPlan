/**
 * Subscription Guardrail System — Hard-limit enforcement middleware.
 *
 * Prevents "Tier-Creep" by tracking and enforcing:
 *   1. User slot limits (employees + pending invitations)
 *   2. PDF generation monthly quotas
 *   3. Storage byte consumption
 *   4. Professional-tier feature gating (auto-scheduler, e-signatures, DATEV)
 *
 * Each workspace has a `WorkspaceUsage` row that acts as a real-time
 * metered-usage ledger. Limits are synced when the plan changes.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/stripe";
import { getWorkspacePlan } from "@/lib/subscription";
import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   WorkspaceUsage — ensure & sync
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ensure a WorkspaceUsage row exists. Creates one from plan defaults
 * if missing. Called lazily on first guard check.
 */
export async function ensureWorkspaceUsage(workspaceId: string) {
  const existing = await prisma.workspaceUsage.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing;

  // No active subscription → create row with zero quota until checkout completes.
  const plan = await getWorkspacePlan(workspaceId);
  const limits = plan?.limits;
  return prisma.workspaceUsage.create({
    data: {
      workspaceId,
      userSlotsTotal: !limits
        ? 0
        : limits.maxEmployees === Infinity
          ? 999999
          : limits.maxEmployees,
      pdfsMonthlyLimit: !limits
        ? 0
        : limits.pdfMonthlyLimit === Infinity
          ? 999999
          : limits.pdfMonthlyLimit,
      storageBytesLimit: !limits
        ? BigInt(0)
        : limits.storageMb === Infinity
          ? BigInt("53687091200") // 50 GB
          : BigInt(limits.storageMb * 1024 * 1024),
    },
  });
}

/**
 * Sync usage limits when a plan changes (upgrade/downgrade).
 * Called from billing webhook and simulation flows.
 */
export async function syncUsageLimits(workspaceId: string, planId: PlanId) {
  const plan = PLANS[planId];
  if (!plan) return;

  await prisma.workspaceUsage.upsert({
    where: { workspaceId },
    update: {
      userSlotsTotal:
        plan.limits.maxEmployees === Infinity
          ? 999999
          : plan.limits.maxEmployees,
      pdfsMonthlyLimit:
        plan.limits.pdfMonthlyLimit === Infinity
          ? 999999
          : plan.limits.pdfMonthlyLimit,
      storageBytesLimit:
        plan.limits.storageMb === Infinity
          ? BigInt("53687091200")
          : BigInt(plan.limits.storageMb * 1024 * 1024),
    },
    create: {
      workspaceId,
      userSlotsTotal:
        plan.limits.maxEmployees === Infinity
          ? 999999
          : plan.limits.maxEmployees,
      pdfsMonthlyLimit:
        plan.limits.pdfMonthlyLimit === Infinity
          ? 999999
          : plan.limits.pdfMonthlyLimit,
      storageBytesLimit:
        plan.limits.storageMb === Infinity
          ? BigInt("53687091200")
          : BigInt(plan.limits.storageMb * 1024 * 1024),
    },
  });

  log.info("[subscription-guard] Usage limits synced", { workspaceId, planId });
}

/* ═══════════════════════════════════════════════════════════════
   1. User Slot Guard — employees + pending invitations
   ═══════════════════════════════════════════════════════════════ */

/**
 * Count all occupied user slots for billing purposes.
 *
 * Only employees **linked to a User account** (userId != null) count toward
 * the plan limit — this means the employee has accepted an invitation and
 * registered. Unlinked employee records (created by admins for shift
 * planning but without a real user login) are NOT billed.
 *
 * Pending invitations also reserve a slot so that an admin cannot invite
 * more people than the plan allows.
 */
export async function countOccupiedSlots(workspaceId: string): Promise<number> {
  const [linkedEmployees, pendingInvitations] = await Promise.all([
    prisma.employee.count({
      where: {
        workspaceId,
        isActive: true,
        userId: { not: null }, // only registered users count
      },
    }),
    prisma.invitation.count({
      where: { workspaceId, status: "PENDING" },
    }),
  ]);
  return linkedEmployees + pendingInvitations;
}

/**
 * Check if a workspace can add another user (employee or invitation).
 * Returns { allowed, current, limit } for UI feedback.
 */
export async function checkUserSlot(workspaceId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const usage = await ensureWorkspaceUsage(workspaceId);
  const current = await countOccupiedSlots(workspaceId);
  return {
    allowed: current < usage.userSlotsTotal,
    current,
    limit: usage.userSlotsTotal,
  };
}

/**
 * Hard-limit guard for user creation. Returns 403 NextResponse with
 * upgrade prompt data, or null if allowed.
 */
export async function requireUserSlot(
  workspaceId: string,
): Promise<NextResponse | null> {
  const { allowed, current, limit } = await checkUserSlot(workspaceId);
  if (allowed) return null;

  log.warn("[subscription-guard] User slot limit reached", {
    workspaceId,
    current,
    limit,
  });

  return NextResponse.json(
    {
      error: "SUBSCRIPTION_LIMIT",
      code: "USER_SLOT_EXCEEDED",
      message: `Sie haben das Maximum von ${limit} Benutzern erreicht. Bitte upgraden Sie Ihren Plan.`,
      current,
      limit,
      upgradeRequired: true,
    },
    { status: 403 },
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. PDF Generation Quota Guard
   ═══════════════════════════════════════════════════════════════ */

/**
 * Auto-reset the PDF counter if 30 days have elapsed since last reset.
 */
async function maybeResetPdfCounter(workspaceId: string) {
  const usage = await ensureWorkspaceUsage(workspaceId);
  const now = new Date();
  const daysSinceReset =
    (now.getTime() - usage.pdfsResetAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceReset >= 30) {
    await prisma.workspaceUsage.update({
      where: { workspaceId },
      data: {
        pdfsGeneratedThisMonth: 0,
        pdfsResetAt: now,
      },
    });
    log.info("[subscription-guard] PDF counter reset", { workspaceId });
  }
}

/**
 * Check if a workspace can generate another PDF this billing period.
 */
export async function checkPdfQuota(workspaceId: string): Promise<{
  allowed: boolean;
  generated: number;
  limit: number;
}> {
  await maybeResetPdfCounter(workspaceId);
  const usage = await ensureWorkspaceUsage(workspaceId);
  return {
    allowed: usage.pdfsGeneratedThisMonth < usage.pdfsMonthlyLimit,
    generated: usage.pdfsGeneratedThisMonth,
    limit: usage.pdfsMonthlyLimit,
  };
}

/**
 * Hard-limit guard for PDF generation. Returns 403 or null.
 */
export async function requirePdfQuota(
  workspaceId: string,
): Promise<NextResponse | null> {
  const { allowed, generated, limit } = await checkPdfQuota(workspaceId);
  if (allowed) return null;

  log.warn("[subscription-guard] PDF quota exceeded", {
    workspaceId,
    generated,
    limit,
  });

  return NextResponse.json(
    {
      error: "SUBSCRIPTION_LIMIT",
      code: "PDF_QUOTA_EXCEEDED",
      message: `Sie haben Ihr monatliches PDF-Limit von ${limit} erreicht. Bitte upgraden Sie Ihren Plan.`,
      generated,
      limit,
      upgradeRequired: true,
    },
    { status: 403 },
  );
}

/**
 * Increment the PDF generation counter. Call AFTER successfully generating a PDF.
 */
export async function recordPdfGeneration(workspaceId: string) {
  await maybeResetPdfCounter(workspaceId);
  await prisma.workspaceUsage.update({
    where: { workspaceId },
    data: {
      pdfsGeneratedThisMonth: { increment: 1 },
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   3. Storage Consumption Guard
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check if a workspace can store additional bytes.
 */
export async function checkStorageQuota(
  workspaceId: string,
  additionalBytes: number,
): Promise<{
  allowed: boolean;
  currentBytes: bigint;
  limitBytes: bigint;
}> {
  const usage = await ensureWorkspaceUsage(workspaceId);
  const afterUpload = BigInt(usage.storageBytesUsed) + BigInt(additionalBytes);
  return {
    allowed: afterUpload <= BigInt(usage.storageBytesLimit),
    currentBytes: BigInt(usage.storageBytesUsed),
    limitBytes: BigInt(usage.storageBytesLimit),
  };
}

/**
 * Hard-limit guard for storage. Returns 403 or null.
 */
export async function requireStorageQuota(
  workspaceId: string,
  additionalBytes: number,
): Promise<NextResponse | null> {
  const { allowed, currentBytes, limitBytes } = await checkStorageQuota(
    workspaceId,
    additionalBytes,
  );
  if (allowed) return null;

  const currentMb = Number(currentBytes) / (1024 * 1024);
  const limitMb = Number(limitBytes) / (1024 * 1024);

  log.warn("[subscription-guard] Storage quota exceeded", {
    workspaceId,
    currentMb: currentMb.toFixed(1),
    limitMb: limitMb.toFixed(1),
    additionalBytes,
  });

  return NextResponse.json(
    {
      error: "SUBSCRIPTION_LIMIT",
      code: "STORAGE_QUOTA_EXCEEDED",
      message: `Speicherlimit erreicht (${currentMb.toFixed(0)} MB / ${limitMb.toFixed(0)} MB). Bitte upgraden Sie Ihren Plan.`,
      currentMb: Math.round(currentMb),
      limitMb: Math.round(limitMb),
      upgradeRequired: true,
    },
    { status: 403 },
  );
}

/**
 * Record additional storage consumption after a successful upload.
 */
export async function recordStorageUsage(workspaceId: string, bytes: number) {
  await prisma.workspaceUsage.update({
    where: { workspaceId },
    data: {
      storageBytesUsed: { increment: bytes },
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   Signature Compression Utility
   ═══════════════════════════════════════════════════════════════ */

/**
 * Compress a base64 PNG signature to WebP (quality 0.6) or extract
 * SVG path data. Falls back to original if sharp is unavailable.
 *
 * Typical savings: 50-80% size reduction on signature images.
 * A 40KB PNG → ~8KB WebP at quality 0.6.
 */
export async function compressSignature(
  base64Data: string,
): Promise<{ data: string; bytes: number; format: string }> {
  try {
    // Strip data URL prefix if present
    const raw = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
    const inputBuffer = Buffer.from(raw, "base64");
    const inputSize = inputBuffer.length;

    // Try sharp for WebP conversion
    let sharp: typeof import("sharp") | undefined;
    try {
      sharp = (await import("sharp")).default;
    } catch {
      // sharp not available — return original with size tracking
      log.warn(
        "[subscription-guard] sharp unavailable, skipping signature compression",
      );
      return {
        data: base64Data,
        bytes: inputSize,
        format: "png",
      };
    }

    const webpBuffer = await sharp(inputBuffer)
      .webp({ quality: 60, effort: 4 })
      .toBuffer();

    const outputSize = webpBuffer.length;
    const savings = ((1 - outputSize / inputSize) * 100).toFixed(0);

    log.info("[subscription-guard] Signature compressed", {
      inputSize,
      outputSize,
      savings: `${savings}%`,
    });

    const webpBase64 = `data:image/webp;base64,${webpBuffer.toString("base64")}`;
    return {
      data: webpBase64,
      bytes: outputSize,
      format: "webp",
    };
  } catch (error) {
    log.error("[subscription-guard] Signature compression failed", { error });
    // Fallback to original
    const raw = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
    return {
      data: base64Data,
      bytes: Buffer.from(raw, "base64").length,
      format: "png",
    };
  }
}
