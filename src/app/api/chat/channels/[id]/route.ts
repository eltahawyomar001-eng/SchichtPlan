import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { requireManagement } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * GET /api/chat/channels/[id]
 * Channel details with member list.
 */
export async function GET(
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

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Verify membership
    const isMember = channel.members.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.userId === user.id,
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 403 },
      );
    }

    return NextResponse.json(channel);
  } catch (error) {
    log.error("Error fetching channel:", { error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

/**
 * PATCH /api/chat/channels/[id]
 * Update channel name/description. Creator or management only.
 */
export async function PATCH(
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

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only creator or management can edit
    if (channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: updateData,
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "ChatChannel",
      entityId: channelId,
      userId: user.id,
      userEmail: user.email!,
      workspaceId: user.workspaceId,
      changes: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error updating channel:", { error });
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/channels/[id]
 * Delete channel. Creator or management only.
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

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only creator or management can delete
    if (channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    // Delete in order: messages → members → channel
    await prisma.chatMessage.deleteMany({ where: { channelId } });
    await prisma.chatChannelMember.deleteMany({
      where: { channelId },
    });
    await prisma.chatChannel.delete({ where: { id: channelId } });

    createAuditLog({
      action: "DELETE",
      entityType: "ChatChannel",
      entityId: channelId,
      userId: user.id,
      userEmail: user.email!,
      workspaceId: user.workspaceId,
      metadata: { channelName: channel.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting channel:", { error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
