import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { requireManagement } from "@/lib/authorization";
import { log } from "@/lib/logger";

/**
 * POST /api/chat/channels/[id]/members
 * Add members to a channel. Creator or management only.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = await (prisma as any).chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only creator or management can add members
    if (channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    const body = await req.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array required" },
        { status: 400 },
      );
    }

    // Verify all users belong to the workspace
    const workspaceUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        workspace: { id: user.workspaceId },
      },
      select: { id: true },
    });

    const validIds = workspaceUsers.map((u) => u.id);

    // Create memberships (skip existing via skipDuplicates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).chatChannelMember.createMany({
      data: validIds.map((userId: string) => ({
        channelId,
        userId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ added: result.count });
  } catch (error) {
    log.error("Error adding members:", { error });
    return NextResponse.json(
      { error: "Error adding members" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/chat/channels/[id]/members
 * Remove a member from a channel. Creator, management, or self.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = await params;
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId query param required" },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = await (prisma as any).chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Can remove yourself, or creator/management can remove others
    if (targetUserId !== user.id && channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).chatChannelMember.delete({
      where: { channelId_userId: { channelId, userId: targetUserId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error removing member:", { error });
    return NextResponse.json(
      { error: "Error removing member" },
      { status: 500 },
    );
  }
}
