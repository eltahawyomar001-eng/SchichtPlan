import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import { withRoute, type RouteContext } from "@/lib/with-route";

const VALID_PLANS = new Set(["BASIC", "PROFESSIONAL", "ENTERPRISE"]);

export const PATCH = withRoute(
  "/api/super-admin/workspaces/[id]/plan",
  "PATCH",
  async (req: Request, context?: RouteContext) => {
    const denied = await requireSuperAdmin();
    if (denied) return denied;

    const { id: workspaceId } = await context!.params;

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as string;
    if (!plan || !VALID_PLANS.has(plan)) {
      return NextResponse.json(
        { error: "plan must be BASIC, PROFESSIONAL, or ENTERPRISE" },
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

    const updated = await prisma.subscription.update({
      where: { workspaceId },
      data: { plan: plan as "BASIC" | "PROFESSIONAL" | "ENTERPRISE" },
      select: { plan: true },
    });

    return NextResponse.json(updated);
  },
);
