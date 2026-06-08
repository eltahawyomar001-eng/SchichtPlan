import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireSuperAdmin,
  getSuperAdminIdentity,
} from "@/lib/super-admin-auth";
import { createAuditLog } from "@/lib/audit";
import { withRoute, type RouteContext } from "@/lib/with-route";

export const POST = withRoute(
  "/api/super-admin/workspaces/[id]/extend-trial",
  "POST",
  async (req: Request, context?: RouteContext) => {
    const denied = await requireSuperAdmin();
    if (denied) return denied;
    const admin = await getSuperAdminIdentity();

    const { id: workspaceId } = await context!.params;

    const body = await req.json().catch(() => ({}));
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return NextResponse.json(
        { error: "days must be an integer between 1 and 90" },
        { status: 400 },
      );
    }

    const sub = await prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    const base =
      sub.trialEnd && sub.trialEnd > new Date() ? sub.trialEnd : new Date();
    const newTrialEnd = new Date(base.getTime() + days * 86_400_000);

    const updated = await prisma.subscription.update({
      where: { workspaceId },
      data: {
        trialEnd: newTrialEnd,
        trialStart: sub.trialStart ?? new Date(),
        status: "TRIALING",
      },
      select: { trialEnd: true, status: true },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Subscription",
      entityId: workspaceId,
      userId: admin?.userId,
      userEmail: admin?.email,
      workspaceId,
      changes: {
        trialEnd: { from: sub.trialEnd, to: updated.trialEnd },
        status: { from: sub.status, to: updated.status },
      },
      metadata: { superAdminAction: "extend-trial", days },
    });

    return NextResponse.json(updated);
  },
);
