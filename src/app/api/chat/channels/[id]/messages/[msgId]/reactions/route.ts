import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { chatReactionSchema, validateBody } from "@/lib/validations";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀"];

/**
 * POST /api/chat/channels/[id]/messages/[msgId]/reactions
 * Toggle a reaction on a message. If it exists, remove it. If not, add it.
 */
export const POST = withRoute(
  "/api/chat/channels/[id]/messages/[msgId]/reactions",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId, msgId } = params;

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
    const parsed = validateBody(chatReactionSchema, body);
    if (!parsed.success) return parsed.response;
    const { emoji } = parsed.data;

    if (!ALLOWED_EMOJIS.includes(emoji)) {
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
  },
  { idempotent: true },
);
