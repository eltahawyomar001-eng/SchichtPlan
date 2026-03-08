import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";

/**
 * POST /api/onboarding/complete
 *
 * Marks the workspace onboarding as completed.
 * Only OWNER or ADMIN can complete onboarding.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: { onboardingCompleted: true },
    });

    log.info("Onboarding completed", {
      workspaceId: user.workspaceId,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error completing onboarding:", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
