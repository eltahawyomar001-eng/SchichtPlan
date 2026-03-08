import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀"];

/**
 * POST /api/chat/channels/[id]/messages/[msgId]/reactions
 * Toggle a reaction on a message. If it exists, remove it. If not, add it.
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

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId, msgId } = await params;

    // Verify membership
    const membership = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 403 },
      );
    }

    // Verify message exists
    const message = await prisma.chatMessage.findFirst({
      where: { id: msgId, channelId, deletedAt: null },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const body = await req.json();
    const { emoji } = body;

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    // Toggle: check if reaction exists
    const existing = await prisma.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: msgId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (existing) {
      // Remove reaction
      await prisma.chatReaction.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ action: "removed", emoji });
    } else {
      // Add reaction
      await prisma.chatReaction.create({
        data: {
          emoji,
          messageId: msgId,
          userId: user.id,
        },
      });
      return NextResponse.json({ action: "added", emoji }, { status: 201 });
    }
  } catch (error) {
    log.error("Error toggling reaction:", { error });
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
