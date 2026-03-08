import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";

/**
 * PATCH /api/chat/channels/[id]/messages/[msgId]
 * Edit a message. Only the sender can edit their own messages.
 */
export async function PATCH(
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
    const content = body.content?.trim();

    if (!content || content.length > 5000) {
      return NextResponse.json(
        { error: "Message must be 1-5000 characters" },
        { status: 400 },
      );
    }

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
  } catch (error) {
    log.error("Error editing message:", { error });
    return NextResponse.json({ error: "Error editing" }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/channels/[id]/messages/[msgId]
 * Soft-delete a message. Sender or management can delete.
 */
export async function DELETE(
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
  } catch (error) {
    log.error("Error deleting message:", { error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
