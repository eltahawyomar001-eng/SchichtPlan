import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { updateChatMessageSchema, validateBody } from "@/lib/validations";

/**
 * PATCH /api/chat/channels/[id]/messages/[msgId]
 * Edit a message. Only the sender can edit their own messages.
 */
export const PATCH = withRoute(
  "/api/chat/channels/[id]/messages/[msgId]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId, msgId } = params;

    const message = await prisma.chatMessage.findFirst({
      where: { id: msgId, channelId, deletedAt: null },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only the sender can edit
    if (message.senderId !== user.id) {
      return NextResponse.json(
        { error: "Can only edit your own messages" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = validateBody(updateChatMessageSchema, body);
    if (!parsed.success) return parsed.response;
    const { content } = parsed.data;

    const updated = await prisma.chatMessage.update({
      where: { id: msgId },
      data: { content, editedAt: new Date() },
      select: {
        id: true,
        content: true,
        senderName: true,
        senderId: true,
        editedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  },
);

/**
 * DELETE /api/chat/channels/[id]/messages/[msgId]
 * Soft-delete a message. Sender or management can delete.
 */
export const DELETE = withRoute(
  "/api/chat/channels/[id]/messages/[msgId]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId, msgId } = params;

    const message = await prisma.chatMessage.findFirst({
      where: { id: msgId, channelId, deletedAt: null },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Sender can delete their own, management can delete any
    if (message.senderId !== user.id) {
      // Check if management
      const { requireManagement } = await import("@/lib/authorization");
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    // Soft delete — set deletedAt, replace content
    await prisma.chatMessage.update({
      where: { id: msgId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  },
);
