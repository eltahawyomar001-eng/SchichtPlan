import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/onboarding/complete
 *
 * Marks the workspace onboarding as completed.
 * Only OWNER or ADMIN can complete onboarding.
 */
export const POST = withRoute(
  "/api/onboarding/complete",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

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
