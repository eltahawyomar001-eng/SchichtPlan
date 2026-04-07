import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/chat/channels/[id]/messages/[msgId]/pin
 * Pin or unpin a message.
 */
export const POST = withRoute(
  "/api/chat/channels/[id]/messages/[msgId]/pin",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id: channelId, msgId } = params;

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
  },
  { idempotent: true },
);
