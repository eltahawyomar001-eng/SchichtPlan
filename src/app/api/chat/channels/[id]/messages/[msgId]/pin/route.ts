import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * POST /api/chat/channels/[id]/messages/[msgId]/pin
 * Pin or unpin a message.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> },
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

    const { id: channelId, msgId } = await params;

    // Verify membership
    const membership = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const message = await prisma.chatMessage.findUnique({
      where: { id: msgId },
      select: { id: true, channelId: true, pinnedAt: true },
    });

    if (!message || message.channelId !== channelId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Toggle pin
    const isPinned = !!message.pinnedAt;
    const updated = await prisma.chatMessage.update({
      where: { id: msgId },
      data: {
        pinnedAt: isPinned ? null : new Date(),
        pinnedBy: isPinned ? null : user.id,
      },
      select: {
        id: true,
        pinnedAt: true,
        pinnedBy: true,
      },
    });

    return NextResponse.json({
      ...updated,
      action: isPinned ? "unpinned" : "pinned",
    });
  } catch (error) {
    log.error("Error toggling pin:", { error });
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
